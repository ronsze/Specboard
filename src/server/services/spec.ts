import { db } from "@/server/db/client";
import { ALL_ROLES, requireRole } from "@/server/authz/authorize";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import { recoverStaleJobs, unconsumedApproved } from "@/server/services/spec-jobs";
import { diffVersions, type Diff } from "@/server/services/spec-diff";
import { NotFoundError } from "@/lib/errors";
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
