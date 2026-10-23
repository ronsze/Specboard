import { db } from "@/server/db/client";
import { NotFoundError } from "@/lib/errors";

/** feature가 이 보드에 속하는지 확인한다 (다른 보드의 feature 접근 방지). */
export async function assertFeatureInBoard(boardId: string, featureId: string) {
  const feature = await db.feature.findFirst({
    where: { id: featureId, project: { boardId } },
    select: { id: true },
  });
  if (!feature) throw new NotFoundError("feature를 찾을 수 없습니다.");
}

