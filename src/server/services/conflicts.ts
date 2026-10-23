import { db } from "@/server/db/client";
import { requireRole } from "@/server/authz/authorize";
import { NotFoundError } from "@/lib/errors";
import { toWarningView, type WarningView } from "@/server/services/conflict-view";

/**
 * 경고를 "확인함"으로 닫는다 (관리자 전용). 입력의 승인·반려 상태에는 영향이 없다.
 * 한 번만 설정되며 이미 확인된 경고는 기존 기록 그대로 돌려준다(멱등).
 */
export async function acknowledgeWarning(
  user: { id: string; displayName: string },
  boardId: string,
  warningId: string,
): Promise<WarningView> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  const found = await db.conflictWarning.findUnique({ where: { id: warningId }, include: { check: { select: { boardId: true } } } });
  // 다른 보드의 경고는 존재 여부를 드러내지 않는다
  if (!found || found.check.boardId !== boardId) throw new NotFoundError("경고를 찾을 수 없습니다.");

  await db.conflictWarning.updateMany({
    where: { id: warningId, acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), acknowledgedBy: user.id, acknowledgedByName: user.displayName },
  });
  return toWarningView(await db.conflictWarning.findUniqueOrThrow({ where: { id: warningId } }));
}
