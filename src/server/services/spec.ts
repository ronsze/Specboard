import { db } from "@/server/db/client";
import { ALL_ROLES, requireRole } from "@/server/authz/authorize";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import { recoverStaleJobs, scheduleSpecUpdate, takeBatch, unconsumedApproved } from "@/server/services/spec-jobs";
import { diffVersions, type Diff } from "@/server/services/spec-diff";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { deriveSpecStatus, type SpecStatus } from "@/server/services/spec-status";
import { Prisma } from "@prisma/client";
import { parse } from "@/server/services/inputs";
import { revertSchema } from "@/lib/schemas/spec";
import {
  summaryInclude,
  toVersionDetail,
  toVersionSummary,
  versionInclude,
  type VersionDetail,
  type VersionSummary,
} from "@/server/services/spec-view";
import { computeProvenance } from "@/server/services/spec-provenance";
import { computeRevertImpact, type RevertExpected, type RevertPreview } from "@/server/services/revert-preview";

export type SpecView = {
  status: SpecStatus;
  message: string | null;
  finalizedByName: string | null;
  finalizedAt: string | null;
  pendingInputCount: number;
  /** 갱신 중일 때: 이번 갱신이 읽는 입력 수 */
  progress: { inputCount: number } | null;
  /** 갱신 실패일 때: 마지막 실패 정보 (마지막 성공 버전은 그대로 version에 담긴다) */
  failure: { attempts: number; at: string; code: string | null; nextVersion: number } | null;
  version: VersionDetail | null;
  recentVersions: VersionSummary[];
};

const FAILURE_REASONS: Record<string, string> = {
  REFUSED: "AI가 요청을 처리하지 못했습니다.",
  INVALID_OUTPUT: "AI 결과가 출처 규칙을 통과하지 못해 반영하지 않았습니다.",
  API_ERROR: "AI 호출에 실패했습니다.",
  TIMEOUT: "AI 응답이 지연되어 반영하지 못했습니다.",
};
const failureMessage = (code: string | null) =>
  `${FAILURE_REASONS[code ?? ""] ?? "spec 갱신에 실패했습니다."} 마지막으로 성공한 spec이 그대로 보이며 입력은 손실되지 않았습니다. 관리자가 다시 시도할 수 있습니다.`;

/** 현재 spec과 상태. 전 역할 열람 가능, 비멤버는 거부 (FR-001, FR-021, FR-024, FR-025). */
export async function getSpec(
  user: { id: string },
  boardId: string,
  featureId: string,
): Promise<SpecView> {
  await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  await recoverStaleJobs(featureId);

  // 작업 상태를 먼저 읽는다. 작업은 입력 소비·버전 저장을 마친 뒤에 DONE이 되므로,
  // 작업이 끝난 것을 본 다음에 읽는 입력·버전에는 반드시 그 결과가 반영되어 있다
  // (반대 순서로 읽으면 "작업 없음 + 아직 반영 안 된 입력"이라는 어긋난 화면이 나올 수 있다).
  const activeJob = await db.specJob.findFirst({ where: { featureId, status: { in: ["QUEUED", "RUNNING"] } } });
  const latestJob = await db.specJob.findFirst({ where: { featureId }, orderBy: { createdAt: "desc" } });

  const spec = await db.spec.findUnique({
    where: { featureId },
    include: { versions: { orderBy: { number: "desc" }, take: 1, include: versionInclude } },
  });
  const pending = await db.input.findMany({
    where: unconsumedApproved(featureId),
    orderBy: [{ decidedAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true },
  });
  const pendingInputCount = pending.length;
  const latestVersion = spec?.versions[0] ?? null;

  let version: VersionDetail | null = null;
  let recentVersions: VersionSummary[] = [];
  if (spec && latestVersion) {
    const [itemRows, questionRows, recent] = await Promise.all([
      db.specItem.findMany({
        where: { version: { specId: spec.id } },
        select: { key: true, text: true, version: { select: { number: true } } },
      }),
      db.openQuestion.findMany({
        where: { version: { specId: spec.id } },
        select: { key: true, status: true, version: { select: { number: true } } },
      }),
      db.specVersion.findMany({
        where: { specId: spec.id },
        orderBy: { number: "desc" },
        take: 3,
        include: summaryInclude,
      }),
    ]);
    const provenance = computeProvenance(
      itemRows.map((r) => ({ key: r.key, text: r.text, versionNumber: r.version.number })),
      questionRows.map((r) => ({ key: r.key, status: r.status, versionNumber: r.version.number })),
      latestVersion.number,
    );
    version = toVersionDetail(latestVersion, provenance, true);
    recentVersions = recent.map((v) => toVersionSummary(v, v.number === latestVersion.number));
  }

  const base = {
    finalizedByName: spec?.finalizedByName ?? null,
    finalizedAt: spec?.finalizedAt?.toISOString() ?? null,
    pendingInputCount,
    version,
    recentVersions,
  };

  const status = deriveSpecStatus({
    finalized: Boolean(spec?.finalizedAt),
    activeJob: Boolean(activeJob),
    latestJobFailed: latestJob?.status === "FAILED",
    pendingCount: pendingInputCount,
    hasVersion: Boolean(version),
  });

  const messages: Record<SpecStatus, string | null> = {
    FINALIZED:
      pendingInputCount > 0
        ? `확정 상태입니다. 반영 대기 입력 ${pendingInputCount}개는 확정을 해제하면 반영됩니다.`
        : null,
    UPDATING: "AI가 spec을 갱신하고 있습니다.",
    FAILED: failureMessage(latestJob?.lastError ?? null),
    NONE: "승인된 입력이 아직 없습니다.",
    IDLE: null,
  };
  return {
    ...base,
    status,
    message: messages[status],
    progress: status === "UPDATING" ? { inputCount: takeBatch(pending).length } : null,
    failure:
      status === "FAILED" && latestJob
        ? {
            attempts: latestJob.attempts,
            at: latestJob.updatedAt.toISOString(),
            code: latestJob.lastError,
            nextVersion: (latestVersion?.number ?? 0) + 1,
          }
        : null,
  };
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
    include: summaryInclude,
  });
  return versions.map((v, i) => toVersionSummary(v, i === 0));
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
  if (from === to) throw new ValidationError("서로 다른 두 버전을 선택해 주세요.");
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

const snapshotInclude = {
  items: { include: { sources: true } },
  questions: { include: { sources: true } },
} as const;

/** 확정·없는 버전·내용 동일을 검사하고, 되돌리기에 필요한 (대상, 최신) 스냅샷과 영향을 계산한다. */
async function loadRevertContext(tx: Prisma.TransactionClient, featureId: string, target: number) {
  const spec = await tx.spec.findUnique({ where: { featureId } });
  if (!spec) throw new NotFoundError("버전을 찾을 수 없습니다.");
  if (spec.finalizedAt) {
    throw new ConflictError("확정된 spec은 되돌릴 수 없습니다. 먼저 확정을 해제하세요.", { code: "FINALIZED" });
  }
  const source = await tx.specVersion.findUnique({
    where: { specId_number: { specId: spec.id, number: target } },
    include: snapshotInclude,
  });
  if (!source) throw new NotFoundError("버전을 찾을 수 없습니다.");
  const latest = await tx.specVersion.findFirstOrThrow({
    where: { specId: spec.id },
    orderBy: { number: "desc" },
    include: snapshotInclude,
  });
  if (sameContent(source, latest)) {
    throw new ConflictError("현재 버전과 같은 내용이라 되돌릴 변화가 없습니다.", { code: "NO_CHANGE" });
  }
  const impact = computeRevertImpact(latest, source);
  const preview: RevertPreview = {
    toVersion: source.number,
    latestVersion: latest.number,
    newVersion: latest.number + 1,
    finalized: false,
    ...impact,
  };
  return { spec, source, latest, preview };
}

/** 되돌리기 영향 미리보기 (관리자 전용, 저장하지 않는 계산). revertSpec과 같은 계산을 쓴다. */
export async function previewRevert(
  user: { id: string },
  boardId: string,
  featureId: string,
  toVersion: number,
): Promise<RevertPreview> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  const { toVersion: target } = parse(revertSchema, { toVersion });
  return (await loadRevertContext(db, featureId, target)).preview;
}

/**
 * 이전 버전으로 되돌린다 (관리자 전용). 선택한 버전과 같은 내용의 새 버전을 만들고 기존 버전은 보존한다.
 * 확정 상태이거나 최신 버전과 내용이 같으면 거부한다 (FR-014~FR-016, FR-020, FR-022).
 * expected(미리보기 때의 최신 버전과 영향 수치)를 주면 달라졌을 때 실행하지 않고 PREVIEW_CHANGED로 거부한다 (FR-030).
 */
export async function revertSpec(
  user: { id: string; displayName: string },
  boardId: string,
  featureId: string,
  toVersion: number,
  expected?: RevertExpected,
): Promise<VersionSummary> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  const { toVersion: target } = parse(revertSchema, { toVersion });

  return db.$transaction(async (tx) => {
    await tx.$executeRaw(lockFeature(featureId));
    const { spec, source, latest, preview } = await loadRevertContext(tx, featureId, target);
    if (
      expected &&
      (expected.latestVersion !== preview.latestVersion ||
        expected.removedItems !== preview.removedItems ||
        expected.reopenedQuestions !== preview.reopenedQuestions)
    ) {
      throw new ConflictError("미리보기 이후 spec이 바뀌었습니다. 영향을 다시 확인해 주세요.", {
        code: "PREVIEW_CHANGED",
        preview,
      });
    }

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
          number: item.number,
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
          number: q.number,
          sources: { create: q.sources.map((s) => ({ inputId: s.inputId })) },
        },
      });
    }
    await tx.spec.update({ where: { id: spec.id }, data: { currentVersionId: created.id } });
    return toVersionSummary({ ...created, inputs: [] }, true);
  }, { timeout: 30_000, maxWait: 10_000 });
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
