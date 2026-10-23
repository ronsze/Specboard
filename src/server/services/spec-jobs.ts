import { after } from "next/server";
import { Prisma, type SpecJob } from "@prisma/client";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/authz/authorize";
import { ConflictError } from "@/lib/errors";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import {
  SpecWriterError,
  type CurrentItem,
  type CurrentQuestion,
  type SpecWriter,
  type SpecWriterErrorCode,
} from "@/server/ai/spec-writer";
import { validateSpecOutput } from "@/server/ai/validate-output";
import { getSpecWriter } from "@/server/ai";
import { allocateItemNumber, allocateQuestionNumber } from "@/server/services/numbering";

export const MAX_BATCH_INPUTS = 20;
export const MAX_BATCH_CHARS = 150_000;
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
const MAX_WAIT_MS = 30_000;

const retryBaseMs = () => Number(process.env.SPEC_RETRY_BASE_MS ?? 5_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lockKey = (featureId: string) => Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${featureId}))`;

/** 승인되었으나 아직 어떤 버전에도 반영되지 않은 입력 (승인 순서). */
export const unconsumedApproved = (featureId: string) =>
  ({ featureId, status: "APPROVED", consumedAt: null }) satisfies Prisma.InputWhereInput;

/**
 * 갱신 작업을 등록한다. 확정 상태이거나 반영할 입력이 없거나 이미 활성 작업이 있으면 아무 것도 하지 않는다.
 * feature당 활성(QUEUED/RUNNING) 작업은 부분 유니크 인덱스가 1개로 제한한다.
 */
export async function requestSpecUpdate(featureId: string): Promise<boolean> {
  const spec = await db.spec.findUnique({ where: { featureId }, select: { finalizedAt: true } });
  if (spec?.finalizedAt) return false;
  if ((await db.input.count({ where: unconsumedApproved(featureId) })) === 0) return false;
  try {
    await db.specJob.create({ data: { featureId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** 승인 경로에서 호출: 작업을 등록하고, 요청이 끝난 뒤 백그라운드로 처리한다. 실패해도 승인 결과에 영향을 주지 않는다. */
export async function scheduleSpecUpdate(featureId: string): Promise<void> {
  try {
    await requestSpecUpdate(featureId);
    try {
      after(() => drainSpecJobs(featureId).catch((e) => console.error("spec update failed", e)));
    } catch {
      // 요청 범위 밖(테스트, 스크립트)에서는 호출자가 drainSpecJobs를 직접 실행한다
    }
  } catch (e) {
    console.error("spec update request failed", e);
  }
}

/** 임대가 만료된 RUNNING 작업을 되살린다 (프로세스가 죽은 경우). */
export async function recoverStaleJobs(featureId: string): Promise<void> {
  await db.specJob.updateMany({
    where: { featureId, status: "RUNNING", leaseUntil: { lt: new Date() } },
    data: { status: "QUEUED", leaseUntil: null, runAfter: new Date() },
  });
}

async function claimNextJob(featureId: string): Promise<SpecJob | null> {
  await recoverStaleJobs(featureId);
  const candidate = await db.specJob.findFirst({
    where: { featureId, status: "QUEUED", runAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;
  const { count } = await db.specJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      leaseUntil: new Date(Date.now() + LEASE_MS),
    },
  });
  return count === 1 ? db.specJob.findUnique({ where: { id: candidate.id } }) : null;
}

type RunResult = "DONE" | "REQUEUED" | "FAILED";

async function finishFailed(job: SpecJob, code: SpecWriterErrorCode): Promise<RunResult> {
  const retryable = code !== "REFUSED" && job.attempts < MAX_ATTEMPTS;
  if (retryable) {
    const delay = retryBaseMs() * 2 ** (job.attempts - 1);
    await db.specJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", lastError: code, leaseUntil: null, runAfter: new Date(Date.now() + delay) },
    });
    return "REQUEUED";
  }
  await db.specJob.update({
    where: { id: job.id },
    data: { status: "FAILED", lastError: code, leaseUntil: null },
  });
  return "FAILED";
}

export function takeBatch<T extends { content: string }>(inputs: T[]): T[] {
  const batch: T[] = [];
  let chars = 0;
  for (const input of inputs) {
    if (batch.length >= MAX_BATCH_INPUTS) break;
    if (batch.length > 0 && chars + input.content.length > MAX_BATCH_CHARS) break;
    batch.push(input);
    chars += input.content.length;
  }
  return batch;
}

/** 작업 하나를 실행한다. 실패해도 Spec·버전·입력 상태는 바꾸지 않는다 (FR-023). */
export async function runSpecJob(job: SpecJob, writer: SpecWriter): Promise<RunResult> {
  const featureId = job.featureId;
  const spec = await db.spec.findUnique({
    where: { featureId },
    include: {
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        include: {
          items: { orderBy: { position: "asc" }, include: { sources: true } },
          questions: { orderBy: { position: "asc" }, include: { sources: true } },
        },
      },
    },
  });
  if (spec?.finalizedAt) {
    await db.specJob.update({ where: { id: job.id }, data: { status: "DONE", leaseUntil: null } });
    return "DONE";
  }

  const pending = await db.input.findMany({
    where: unconsumedApproved(featureId),
    orderBy: [{ decidedAt: "asc" }, { id: "asc" }],
  });
  const batch = takeBatch(pending);
  if (batch.length === 0) {
    await db.specJob.update({ where: { id: job.id }, data: { status: "DONE", leaseUntil: null } });
    return "DONE";
  }

  const base = spec?.versions[0] ?? null;
  const baseNumber = base?.number ?? 0;
  const current: { items: CurrentItem[]; questions: CurrentQuestion[] } = {
    items: (base?.items ?? []).map((i) => ({
      key: i.key,
      kind: i.kind,
      text: i.text,
      sourceInputIds: i.sources.map((s) => s.inputId),
    })),
    questions: (base?.questions ?? []).map((q) => ({
      key: q.key,
      text: q.text,
      status: q.status,
      sourceInputIds: q.sources.map((s) => s.inputId),
      resolvedByInputId: q.resolvedByInputId,
    })),
  };
  const approvedIds = new Set(
    (await db.input.findMany({ where: { featureId, status: "APPROVED" }, select: { id: true } })).map((i) => i.id),
  );
  const batchIds = new Set(batch.map((i) => i.id));

  let output;
  try {
    const raw = await writer.write({
      ...current,
      inputs: batch.map((i) => ({
        id: i.id,
        kind: i.kind,
        submitterName: i.submitterName,
        submittedAt: i.submittedAt.toISOString(),
        content: i.content,
      })),
    });
    output = validateSpecOutput(current, batchIds, approvedIds, raw);
  } catch (e) {
    const code: SpecWriterErrorCode = e instanceof SpecWriterError ? e.code : "API_ERROR";
    if (!(e instanceof SpecWriterError)) console.error("spec writer error", e);
    return finishFailed(job, code);
  }

  // 항목·출처를 순차 저장하므로 큰 spec에서도 기본 5초 제한에 걸리지 않게 넉넉히 둔다
  const committed = await db.$transaction(async (tx) => {
    await tx.$executeRaw(lockKey(featureId));
    const fresh = await tx.spec.findUnique({
      where: { featureId },
      include: { versions: { orderBy: { number: "desc" }, take: 1, select: { number: true } } },
    });
    // AI 호출 중에 확정되었거나 되돌리기가 일어났으면 결과를 폐기하고 입력은 미소비로 둔다
    if (fresh?.finalizedAt) return "FINALIZED" as const;
    if ((fresh?.versions[0]?.number ?? 0) !== baseNumber) return "STALE" as const;

    const target = fresh ?? (await tx.spec.create({ data: { featureId } }));
    const consumed = await tx.input.updateMany({
      where: { id: { in: [...batchIds] }, consumedAt: null, status: "APPROVED" },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== batchIds.size) throw new Error("INPUTS_ALREADY_CONSUMED");

    const version = await tx.specVersion.create({
      data: {
        specId: target.id,
        number: baseNumber + 1,
        kind: "AI_UPDATE",
        model: writer.modelName,
        inputs: { create: [...batchIds].map((inputId) => ({ inputId })) },
      },
    });
    // 기존 key는 직전 버전의 번호를 그대로 쓰고, 새 key에만 새 번호를 부여한다 (안정 번호)
    const itemNumbers = new Map((base?.items ?? []).map((i) => [i.key, i.number]));
    const questionNumbers = new Map((base?.questions ?? []).map((q) => [q.key, q.number]));
    for (const [position, item] of output.items.entries()) {
      const number = itemNumbers.get(item.key!) ?? (await allocateItemNumber(tx, target.id, item.kind));
      await tx.specItem.create({
        data: {
          versionId: version.id,
          key: item.key!,
          kind: item.kind,
          text: item.text,
          position,
          number,
          sources: { create: [...new Set(item.sourceInputIds)].map((inputId) => ({ inputId })) },
        },
      });
    }
    for (const [position, q] of output.questions.entries()) {
      const number = questionNumbers.get(q.key!) ?? (await allocateQuestionNumber(tx, target.id));
      await tx.openQuestion.create({
        data: {
          versionId: version.id,
          key: q.key!,
          text: q.text,
          status: q.status,
          resolvedByInputId: q.resolvedByInputId,
          position,
          number,
          sources: { create: [...new Set(q.sourceInputIds)].map((inputId) => ({ inputId })) },
        },
      });
    }
    await tx.input.updateMany({ where: { id: { in: [...batchIds] } }, data: { consumedVersionId: version.id } });
    await tx.spec.update({ where: { id: target.id }, data: { currentVersionId: version.id } });
    return "OK" as const;
  }, { timeout: 30_000, maxWait: 10_000 }).catch((e) => {
    if (e instanceof Error && e.message === "INPUTS_ALREADY_CONSUMED") return "STALE" as const;
    throw e;
  });

  if (committed === "STALE") {
    await db.specJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", attempts: Math.max(0, job.attempts - 1), leaseUntil: null, runAfter: new Date() },
    });
    return "REQUEUED";
  }
  await db.specJob.update({ where: { id: job.id }, data: { status: "DONE", lastError: null, leaseUntil: null } });
  return "DONE";
}

/**
 * feature의 대기 작업을 모두 처리한다. 한 번에 한 작업만 실행되고(원자적 claim),
 * 끝난 뒤 반영 대기 입력이 남아 있으면 이어서 처리한다.
 */
export async function drainSpecJobs(featureId: string, writer: SpecWriter = getSpecWriter()): Promise<void> {
  for (let guard = 0; guard < 200; guard++) {
    const job = await claimNextJob(featureId);
    if (!job) {
      const waiting = await db.specJob.findFirst({ where: { featureId, status: "QUEUED" } });
      if (waiting && waiting.runAfter.getTime() > Date.now()) {
        await sleep(Math.min(waiting.runAfter.getTime() - Date.now(), MAX_WAIT_MS));
        continue;
      }
      return;
    }
    const result = await runSpecJob(job, writer);
    if (result === "DONE") await requestSpecUpdate(featureId);
  }
}

/** 관리자 전용: 실패한 갱신을 다시 시도한다 (FR-023). */
export async function retrySpecJob(
  user: { id: string },
  boardId: string,
  featureId: string,
): Promise<void> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  const spec = await db.spec.findUnique({ where: { featureId }, select: { finalizedAt: true } });
  if (spec?.finalizedAt) throw new ConflictError("확정된 spec은 갱신할 수 없습니다. 먼저 확정을 해제하세요.");
  const latest = await db.specJob.findFirst({ where: { featureId }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.status !== "FAILED") throw new ConflictError("재시도할 실패한 갱신이 없습니다.");
  if (!(await requestSpecUpdate(featureId))) throw new ConflictError("반영할 입력이 없거나 이미 진행 중입니다.");
  try {
    after(() => drainSpecJobs(featureId).catch((e) => console.error("spec retry failed", e)));
  } catch {
    // 요청 범위 밖
  }
}
