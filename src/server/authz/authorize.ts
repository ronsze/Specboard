import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { ForbiddenError } from "@/lib/errors";

/**
 * 모든 서비스 함수가 거치는 단일 권한 검사 진입점.
 * 비멤버와 역할 부족은 구분 없이 ForbiddenError (보드 존재 여부를 드러내지 않는다).
 */
export async function requireRole(
  userId: string,
  boardId: string,
  allowed: readonly Role[],
): Promise<Role> {
  const membership = await db.membership.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  if (!membership || !allowed.includes(membership.role)) throw new ForbiddenError();
  return membership.role;
}

export const ALL_ROLES: readonly Role[] = ["ADMIN", "MEMBER", "VIEWER"];
