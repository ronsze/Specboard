import { after } from "next/server";
import { Prisma, type ConflictCheck } from "@prisma/client";
import { db } from "@/server/db/client";
import { getConflictDetector } from "@/server/ai";
import {
  ConflictDetectorError,
  MAX_COMPARE_CHARS,
  MAX_COMPARE_ITEMS,
  type ConflictDetector,
  type ConflictErrorCode,
} from "@/server/ai/conflict-detector";
import { validateConflicts } from "@/server/ai/validate-conflicts";

const LEASE_MS = 5 * 60_000;
const MAX_WAIT_MS = 30_000;
export const MAX_CONFLICT_ATTEMPTS = 3;

const retryBaseMs = () => Number(process.env.SPEC_RETRY_BASE_MS ?? 5_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lockKey = (featureId: string) => Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${featureId}))`;

export const ACTIVE_STATUSES = ["QUEUED", "RUNNING"] as const;

type Client = Pick<typeof db, "spec" | "specVersion">;

/** feature의 spec 최신 버전과 항목·열린 질문. 없으면 null. */
async function latestSpec(client: Client, featureId: string) {
  const spec = await client.spec.findUnique({ where: { featureId }, select: { id: true, finalizedAt: true } });
  if (!spec) return null;
  const version = await client.specVersion.findFirst({
    where: { specId: spec.id },
    orderBy: { number: "desc" },
    select: {
      number: true,
      items: { orderBy: { position: "asc" }, select: { key: true, kind: true, number: true, text: true } },
      questions: { where: { status: "OPEN" }, orderBy: { position: "asc" }, select: { key: true, number: true, text: true } },
    },
  });
  if (!version) return null;
  return { finalized: spec.finalizedAt !== null, ...version };
}

/**
 * 입력 하나의 충돌 검사를 등록한다. 대기 입력만 대상이며(관리자 자동 승인·처리된 입력 제외),
 * 비교할 spec이나 항목이 없으면 AI 없이 즉시 SKIPPED로 기록한다.
 * 제출 요청 안에서는 DB 읽기·쓰기만 하고 AI 호출은 하지 않는다 (FR-001, FR-010, FR-011).
 */
export async function requestConflictCheck(inputId: string): Promise<"QUEUED" | "SKIPPED" | "NONE"> {
  const input = await db.input.findUnique({
    where: { id: inputId },
    select: { id: true, boardId: true, featureId: true, status: true },
  });
  if (!input || input.status !== "PENDING") return "NONE";

  const spec = await latestSpec(db, input.featureId);
  const base = { inputId: input.id, boardId: input.boardId, featureId: input.featureId };
  try {
    if (!spec || spec.items.length === 0) {
      await db.conflictCheck.create({
        data: { ...base, status: "SKIPPED", skipReason: spec ? "NO_ITEMS" : "NO_SPEC", completedAt: new Date() },
      });
      return "SKIPPED";
    }
    await db.conflictCheck.create({ data: { ...base, status: "QUEUED" } });
    return "QUEUED";
  } catch (e) {
    // 입력당 활성 검사는 하나뿐이다 (부분 유니크 인덱스)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "NONE";
    throw e;
  }
}

/** 제출 경로에서 호출: 등록 후 요청이 끝난 뒤 백그라운드로 실행한다. 어떤 오류도 제출 결과에 영향을 주지 않는다 (FR-013). */
export async function scheduleConflictCheck(inputId: string): Promise<void> {
  try {
    if ((await requestConflictCheck(inputId)) === "QUEUED") {
      try {
        after(() => drainConflictChecks({ inputId }).catch((e) => console.error("conflict check failed", e)));
      } catch {
        // 요청 범위 밖(테스트, 스크립트)에서는 호출자가 drainConflictChecks를 직접 실행한다
      }
    }
  } catch (e) {
    console.error("conflict check request failed", e);
  }
}

/** 임대가 만료된 RUNNING 검사를 되살린다 (프로세스가 죽은 경우). */
export async function recoverStaleConflictChecks(boardId?: string): Promise<void> {
  await db.conflictCheck.updateMany({
    where: { ...(boardId && { boardId }), status: "RUNNING", leaseUntil: { lt: new Date() } },
    data: { status: "QUEUED", leaseUntil: null, runAfter: new Date() },
  });
}

/** 승인 화면 렌더에서 호출: 멈춘 검사를 회수하고 남은 검사를 이어서 실행한다. */
export async function kickConflictChecks(boardId: string): Promise<void> {
  await recoverStaleConflictChecks(boardId);
  const pending = await db.conflictCheck.count({ where: { boardId, status: { in: [...ACTIVE_STATUSES] } } });
  if (pending === 0) return;
  try {
    after(() => drainConflictChecks({ boardId }).catch((e) => console.error("conflict check failed", e)));
  } catch {
    // 요청 범위 밖
  }
}

async function claimNext(scope: { inputId?: string; boardId?: string }): Promise<ConflictCheck | null> {
  await recoverStaleConflictChecks(scope.boardId);
  const candidate = await db.conflictCheck.findFirst({
    where: {
      status: "QUEUED",
      runAfter: { lte: new Date() },
      ...(scope.inputId && { inputId: scope.inputId }),
      ...(scope.boardId && { boardId: scope.boardId }),
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;
  const { count } = await db.conflictCheck.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", attempts: { increment: 1 }, leaseUntil: new Date(Date.now() + LEASE_MS) },
  });
  return count === 1 ? db.conflictCheck.findUnique({ where: { id: candidate.id } }) : null;
}

type RunResult = "DONE" | "SKIPPED" | "REQUEUED" | "FAILED";

async function finishFailed(check: ConflictCheck, code: ConflictErrorCode): Promise<RunResult> {
  const retryable = code !== "REFUSED" && code !== "TOO_LARGE" && check.attempts < MAX_CONFLICT_ATTEMPTS;
  if (retryable) {
    const delay = retryBaseMs() * 2 ** (check.attempts - 1);
    await db.conflictCheck.update({
      where: { id: check.id },
      data: { status: "QUEUED", lastError: code, leaseUntil: null, runAfter: new Date(Date.now() + delay) },
    });
    return "REQUEUED";
  }
  await db.conflictCheck.update({
    where: { id: check.id },
    data: { status: "FAILED", lastError: code, leaseUntil: null, completedAt: new Date() },
  });
  return "FAILED";
}

/** 검사 하나를 실행한다. 입력이 이미 승인·반려되었어도 끝까지 수행한다 (FR-021). 입력·승인 상태는 건드리지 않는다. */
export async function runConflictCheck(check: ConflictCheck, detector: ConflictDetector): Promise<RunResult> {
  const input = await db.input.findUnique({
    where: { id: check.inputId },
    select: { content: true, kind: true, featureId: true },
  });
  if (!input) return "FAILED";

  const spec = await latestSpec(db, input.featureId);
  if (!spec || spec.items.length === 0) {
    await db.conflictCheck.update({
      where: { id: check.id },
      data: { status: "SKIPPED", skipReason: spec ? "NO_ITEMS" : "NO_SPEC", leaseUntil: null, completedAt: new Date() },
    });
    return "SKIPPED";
  }

  const chars = input.content.length + spec.items.reduce((n, i) => n + i.text.length, 0);
  if (spec.items.length > MAX_COMPARE_ITEMS || chars > MAX_COMPARE_CHARS) return finishFailed(check, "TOO_LARGE");

  let candidates;
  try {
    candidates = await detector.detect({
      input: { kind: input.kind, content: input.content },
      items: spec.items.map((i) => ({
        key: i.key,
        label: `${i.kind === "DECISION" ? "D" : "R"}-${i.number}`,
        kind: i.kind,
        text: i.text,
        finalized: spec.finalized,
      })),
      openQuestions: spec.questions.map((q) => ({ key: q.key, label: `Q-${q.number}`, text: q.text })),
    });
  } catch (e) {
    const code: ConflictErrorCode = e instanceof ConflictDetectorError ? e.code : "API_ERROR";
    if (!(e instanceof ConflictDetectorError)) console.error("conflict detector error", e);
    return finishFailed(check, code);
  }

  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw(lockKey(input.featureId));
      // 저장 시점의 최신 버전으로 다시 확인한다: 검사 도중 되돌리기·새 버전으로 사라진 항목은 저장하지 않는다 (SC-003)
      const latest = await latestSpec(tx, input.featureId);
      const warnings = latest ? validateConflicts(candidates, latest.items, input.content) : [];
      for (const w of warnings) {
        await tx.conflictWarning.create({
          data: { checkId: check.id, inputId: check.inputId, onFinalizedSpec: latest!.finalized, ...w },
        });
      }
      await tx.conflictCheck.update({
        where: { id: check.id },
        data: {
          status: "DONE",
          lastError: null,
          leaseUntil: null,
          completedAt: new Date(),
          baseVersionNumber: spec.number, // AI가 본 버전 (이후 spec이 갱신되면 stale)
          model: detector.modelName,
        },
      });
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  return "DONE";
}

/** 대기 중인 검사를 모두 처리한다. 한 검사는 한 번에 한 곳에서만 실행된다(원자적 claim). */
export async function drainConflictChecks(
  scope: { inputId?: string; boardId?: string } = {},
  detector: ConflictDetector = getConflictDetector(),
): Promise<void> {
  for (let guard = 0; guard < 500; guard++) {
    const check = await claimNext(scope);
    if (!check) {
      const waiting = await db.conflictCheck.findFirst({
        where: {
          status: "QUEUED",
          ...(scope.inputId && { inputId: scope.inputId }),
          ...(scope.boardId && { boardId: scope.boardId }),
        },
        orderBy: { runAfter: "asc" },
      });
      if (waiting && waiting.runAfter.getTime() > Date.now()) {
        await sleep(Math.min(waiting.runAfter.getTime() - Date.now(), MAX_WAIT_MS));
        continue;
      }
      return;
    }
    await runConflictCheck(check, detector);
  }
}
