import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db/client";
import { deriveSpecStatus, type SpecStatus } from "@/server/services/spec-status";

export type HomeFeature = {
  id: string;
  name: string;
  specStatus: SpecStatus;
  latestVersion: number | null;
  latestVersionAt: string | null;
  pendingReflectCount: number;
  /** 갱신 중일 때 만들고 있는 버전 번호 */
  updatingToVersion: number | null;
};

export type HomeBoard = {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  /** 관리자 보드에서만 */
  pendingApprovalCount: number | null;
  projects: { id: string; name: string; features: HomeFeature[] }[];
};

export type HomeView = { boards: HomeBoard[] };

/**
 * 홈 요약: 사용자가 속한 보드·프로젝트·feature와 feature별 spec 상태.
 * feature 수에 비례하는 쿼리를 쓰지 않고 IN/groupBy로 한 번씩만 조회한다.
 * 작업 상태를 먼저 읽는 순서는 getSpec과 같다(작업이 끝난 것을 본 뒤에 읽는 데이터에는 결과가 반영되어 있다).
 */
export async function getHome(user: { id: string }, client: PrismaClient = db): Promise<HomeView> {
  const memberships = await client.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      board: {
        select: {
          id: true,
          name: true,
          projects: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, features: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const featureIds = memberships.flatMap((m) => m.board.projects.flatMap((p) => p.features.map((f) => f.id)));
  const adminBoardIds = memberships.filter((m) => m.role === "ADMIN").map((m) => m.board.id);

  const activeJobs = await client.specJob.findMany({
    where: { featureId: { in: featureIds }, status: { in: ["QUEUED", "RUNNING"] } },
    select: { featureId: true },
  });
  const latestJobs = await client.specJob.findMany({
    where: { featureId: { in: featureIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["featureId"],
    select: { featureId: true, status: true },
  });
  const specs = await client.spec.findMany({
    where: { featureId: { in: featureIds } },
    select: {
      featureId: true,
      finalizedAt: true,
      versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, createdAt: true } },
    },
  });
  const pendingReflect = await client.input.groupBy({
    by: ["featureId"],
    where: { featureId: { in: featureIds }, status: "APPROVED", consumedAt: null },
    _count: { _all: true },
  });
  const pendingApproval = await client.input.groupBy({
    by: ["boardId"],
    where: { boardId: { in: adminBoardIds }, status: "PENDING" },
    _count: { _all: true },
  });

  const active = new Set(activeJobs.map((j) => j.featureId));
  const failed = new Set(latestJobs.filter((j) => j.status === "FAILED").map((j) => j.featureId));
  const specByFeature = new Map(specs.map((s) => [s.featureId, s]));
  const reflectCount = new Map(pendingReflect.map((r) => [r.featureId, r._count._all]));
  const approvalCount = new Map(pendingApproval.map((r) => [r.boardId, r._count._all]));

  return {
    boards: memberships.map((m) => ({
      id: m.board.id,
      name: m.board.name,
      role: m.role,
      pendingApprovalCount: m.role === "ADMIN" ? (approvalCount.get(m.board.id) ?? 0) : null,
      projects: m.board.projects.map((p) => ({
        id: p.id,
        name: p.name,
        features: p.features.map((f): HomeFeature => {
          const spec = specByFeature.get(f.id);
          const latest = spec?.versions[0] ?? null;
          const pending = reflectCount.get(f.id) ?? 0;
          const specStatus = deriveSpecStatus({
            finalized: Boolean(spec?.finalizedAt),
            activeJob: active.has(f.id),
            latestJobFailed: failed.has(f.id),
            pendingCount: pending,
            hasVersion: Boolean(latest),
          });
          return {
            id: f.id,
            name: f.name,
            specStatus,
            latestVersion: latest?.number ?? null,
            latestVersionAt: latest?.createdAt.toISOString() ?? null,
            pendingReflectCount: pending,
            updatingToVersion: specStatus === "UPDATING" ? (latest?.number ?? 0) + 1 : null,
          };
        }),
      })),
    })),
  };
}
