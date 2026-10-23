import { db } from "@/server/db/client";
import { requireRole } from "@/server/authz/authorize";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import { toDto, type InputDto } from "@/server/services/inputs";

export type PendingInputDto = InputDto & { projectName: string; featureName: string };

/** 보드 전체의 승인 대기 입력 (관리자 전용). 제출 시각 오름차순, 보드 인덱스로 한 번에 조회한다. */
export async function listBoardPending(
  user: { id: string },
  boardId: string,
  opts: { featureId?: string } = {},
): Promise<PendingInputDto[]> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  if (opts.featureId) await assertFeatureInBoard(boardId, opts.featureId);
  const inputs = await db.input.findMany({
    where: { boardId, status: "PENDING", ...(opts.featureId && { featureId: opts.featureId }) },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    include: { feature: { select: { name: true, project: { select: { name: true } } } } },
  });
  return inputs.map((i) => ({
    ...toDto(i, { userId: user.id }),
    projectName: i.feature.project.name,
    featureName: i.feature.name,
  }));
}

/** 상단 배지용 대기 입력 수 (관리자 전용). */
export async function countBoardPending(user: { id: string }, boardId: string): Promise<number> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  return db.input.count({ where: { boardId, status: "PENDING" } });
}
