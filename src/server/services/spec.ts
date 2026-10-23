import { db } from "@/server/db/client";
import { ALL_ROLES, requireRole } from "@/server/authz/authorize";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import { recoverStaleJobs, scheduleSpecUpdate, unconsumedApproved } from "@/server/services/spec-jobs";
import { diffVersions, type Diff } from "@/server/services/spec-diff";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { parse } from "@/server/services/inputs";
import { revertSchema } from "@/lib/schemas/spec";
import {
  toVersionDetail,
  toVersionSummary,
  versionInclude,
  type VersionDetail,
  type VersionSummary,
} from "@/server/services/spec-view";

export type SpecStatus = "NONE" | "IDLE" | "UPDATING" | "FAILED" | "FINALIZED";

export type SpecView = {
  status: SpecStatus;
  message: string | null;
  finalizedByName: string | null;
  finalizedAt: string | null;
  pendingInputCount: number;
  version: VersionDetail | null;
};

const FAILURE_MESSAGES: Record<string, string> = {
  REFUSED: "AI가 요청을 처리하지 못했습니다. 관리자가 다시 시도할 수 있습니다.",
  INVALID_OUTPUT: "AI 결과가 출처 규칙을 통과하지 못해 반영하지 않았습니다. 관리자가 다시 시도할 수 있습니다.",
  API_ERROR: "AI 호출에 실패했습니다. 관리자가 다시 시도할 수 있습니다.",
  TIMEOUT: "AI 응답이 지연되어 반영하지 못했습니다. 관리자가 다시 시도할 수 있습니다.",
};

/** 현재 spec과 상태. 전 역할 열람 가능, 비멤버는 거부 (FR-001, FR-021, FR-024, FR-025). */
export async function getSpec(
  user: { id: string },
  boardId: string,
  featureId: string,
): Promise<SpecView> {
  await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  await recoverStaleJobs(featureId);

  const spec = await db.spec.findUnique({
    where: { featureId },
    include: { versions: { orderBy: { number: "desc" }, take: 1, include: versionInclude } },
  });
  const pendingInputCount = await db.input.count({ where: unconsumedApproved(featureId) });
  const latestVersion = spec?.versions[0] ?? null;
  const version = latestVersion ? toVersionDetail(latestVersion) : null;

  const base = {
    finalizedByName: spec?.finalizedByName ?? null,
    finalizedAt: spec?.finalizedAt?.toISOString() ?? null,
    pendingInputCount,
    version,
  };

  if (spec?.finalizedAt) {
    return { ...base, status: "FINALIZED", message: pendingInputCount > 0 ? `확정 상태입니다. 반영 대기 입력 ${pendingInputCount}개는 확정을 해제하면 반영됩니다.` : null };
  }
  const activeJob = await db.specJob.findFirst({ where: { featureId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (activeJob) return { ...base, status: "UPDATING", message: "AI가 spec을 갱신하고 있습니다." };

  const latestJob = await db.specJob.findFirst({ where: { featureId }, orderBy: { createdAt: "desc" } });
  if (latestJob?.status === "FAILED" && pendingInputCount > 0) {
    return { ...base, status: "FAILED", message: FAILURE_MESSAGES[latestJob.lastError ?? ""] ?? "spec 갱신에 실패했습니다." };
  }
  if (!version && pendingInputCount === 0) {
    return { ...base, status: "NONE", message: "승인된 입력이 아직 없습니다." };
  }
  return { ...base, status: "IDLE", message: null };
}

async function readableSpec(user: { id: string }, boardId: string, featureId: string) {
  await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  return db.spec.findUnique({ where: { featureId }, select: { id: true } });
}

/** 버전 이력, 최신순 (FR-010, FR-012). */
export async function listVersions(
  user: { id: string },
  boardId: string,
  featureId: string,
): Promise<VersionSummary[]> {
  const spec = await readableSpec(user, boardId, featureId);
  if (!spec) return [];
  const versions = await db.specVersion.findMany({
    where: { specId: spec.id },
    orderBy: { number: "desc" },
    include: { inputs: true },
  });
  return versions.map(toVersionSummary);
}

export async function getVersion(
  user: { id: string },
  boardId: string,
  featureId: string,
  number: number,
): Promise<VersionDetail> {
  const spec = await readableSpec(user, boardId, featureId);
  const version = spec
    ? await db.specVersion.findUnique({
        where: { specId_number: { specId: spec.id, number } },
        include: versionInclude,
      })
    : null;
  if (!version) throw new NotFoundError("버전을 찾을 수 없습니다.");
  return toVersionDetail(version);
}

/** 두 버전 비교 (FR-013). */
export async function diff(
  user: { id: string },
  boardId: string,
  featureId: string,
  from: number,
  to: number,
): Promise<Diff> {
  const [a, b] = await Promise.all([
    getVersion(user, boardId, featureId, from),
    getVersion(user, boardId, featureId, to),
  ]);
  return diffVersions(a, b);
}

const lockFeature = (featureId: string) => Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${featureId}))`;

type Snapshot = Prisma.SpecVersionGetPayload<{
  include: {
    items: { include: { sources: true } };
    questions: { include: { sources: true } };
  };
}>;

const sorted = (xs: string[]) => [...xs].sort().join(",");

/** 항목·질문 내용(순서 포함)이 같은지 비교한다. */
function sameContent(a: Snapshot, b: Snapshot): boolean {
  const items = (v: Snapshot) =>
    [...v.items].sort((x, y) => x.position - y.position).map((i) => [i.key, i.kind, i.text, sorted(i.sources.map((s) => s.inputId))]);
  const questions = (v: Snapshot) =>
    [...v.questions]
      .sort((x, y) => x.position - y.position)
      .map((q) => [q.key, q.text, q.status, q.resolvedByInputId, sorted(q.sources.map((s) => s.inputId))]);
  return (
    JSON.stringify(items(a)) === JSON.stringify(items(b)) &&
    JSON.stringify(questions(a)) === JSON.stringify(questions(b))
  );
}

/**
 * 이전 버전으로 되돌린다 (관리자 전용). 선택한 버전과 같은 내용의 새 버전을 만들고 기존 버전은 보존한다.
 * 확정 상태이거나 최신 버전과 내용이 같으면 거부한다 (FR-014~FR-016, FR-020, FR-022).
 */
export async function revertSpec(
  user: { id: string; displayName: string },
  boardId: string,
  featureId: string,
  toVersion: number,
): Promise<VersionSummary> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  const { toVersion: target } = parse(revertSchema, { toVersion });

  return db.$transaction(async (tx) => {
    await tx.$executeRaw(lockFeature(featureId));
    const spec = await tx.spec.findUnique({ where: { featureId } });
    if (!spec) throw new NotFoundError("버전을 찾을 수 없습니다.");
    if (spec.finalizedAt) throw new ConflictError("확정된 spec은 되돌릴 수 없습니다. 먼저 확정을 해제하세요.");

    const include = { items: { include: { sources: true } }, questions: { include: { sources: true } } } as const;
    const source = await tx.specVersion.findUnique({ where: { specId_number: { specId: spec.id, number: target } }, include });
    if (!source) throw new NotFoundError("버전을 찾을 수 없습니다.");
    const latest = await tx.specVersion.findFirstOrThrow({ where: { specId: spec.id }, orderBy: { number: "desc" }, include });
    if (sameContent(source, latest)) throw new ConflictError("현재 버전과 같은 내용이라 되돌릴 변화가 없습니다.");

    const created = await tx.specVersion.create({
      data: {
        specId: spec.id,
        number: latest.number + 1,
        kind: "REVERT",
        revertedFromNumber: source.number,
        createdBy: user.id,
        createdByName: user.displayName,
      },
    });
    for (const item of source.items) {
      await tx.specItem.create({
        data: {
          versionId: created.id,
          key: item.key,
          kind: item.kind,
          text: item.text,
          position: item.position,
          sources: { create: item.sources.map((s) => ({ inputId: s.inputId })) },
        },
      });
    }
    for (const q of source.questions) {
      await tx.openQuestion.create({
        data: {
          versionId: created.id,
          key: q.key,
          text: q.text,
          status: q.status,
          resolvedByInputId: q.resolvedByInputId,
          position: q.position,
          sources: { create: q.sources.map((s) => ({ inputId: s.inputId })) },
        },
      });
    }
    await tx.spec.update({ where: { id: spec.id }, data: { currentVersionId: created.id } });
    return toVersionSummary({ ...created, inputs: [] });
  });
}

/** spec 확정 (관리자 전용). 확정 중에는 새 입력이 승인되어도 새 버전이 만들어지지 않는다 (FR-017, FR-018). */
export async function finalizeSpec(
  user: { id: string; displayName: string },
  boardId: string,
  featureId: string,
): Promise<SpecView> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw(lockFeature(featureId));
    const spec = await tx.spec.findUnique({ where: { featureId } });
    if (!spec?.currentVersionId) throw new ConflictError("확정할 버전이 없습니다.");
    if (spec.finalizedAt) throw new ConflictError("이미 확정된 spec입니다.");
    await tx.spec.update({
      where: { id: spec.id },
      data: { finalizedAt: new Date(), finalizedBy: user.id, finalizedByName: user.displayName },
    });
  });
  return getSpec(user, boardId, featureId);
}

/** 확정 해제 (관리자 전용). 반영 대기 입력이 있으면 갱신 작업을 등록한다 (FR-017, FR-019). */
export async function unfinalizeSpec(
  user: { id: string },
  boardId: string,
  featureId: string,
): Promise<SpecView> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw(lockFeature(featureId));
    const spec = await tx.spec.findUnique({ where: { featureId } });
    if (!spec?.finalizedAt) throw new ConflictError("확정 상태가 아닙니다.");
    await tx.spec.update({
      where: { id: spec.id },
      data: { finalizedAt: null, finalizedBy: null, finalizedByName: null },
    });
  });
  await scheduleSpecUpdate(featureId);
  return getSpec(user, boardId, featureId);
}
