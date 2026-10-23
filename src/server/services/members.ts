import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/authz/authorize";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { memberAddSchema, roleChangeSchema } from "@/lib/schemas/member";
import { parse } from "@/server/services/inputs";

type Actor = { id: string };

export type MemberDto = { userId: string; displayName: string; email: string; role: Role };

type Row = { userId: string; role: Role; user: { displayName: string; email: string } };
const toDto = (m: Row): MemberDto => ({
  userId: m.userId,
  displayName: m.user.displayName,
  email: m.user.email,
  role: m.role,
});
const include = { user: { select: { displayName: true, email: true } } } as const;

export async function listMembers(user: Actor, boardId: string): Promise<MemberDto[]> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  const rows = await db.membership.findMany({ where: { boardId }, include, orderBy: { createdAt: "asc" } });
  return rows.map(toDto);
}

export async function addMember(user: Actor, boardId: string, payload: unknown): Promise<MemberDto> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  const { email, role } = parse(memberAddSchema, payload);
  const target = await db.user.findUnique({ where: { email } });
  if (!target) throw new NotFoundError("해당 이메일의 사용자가 없습니다.");
  const existing = await db.membership.findUnique({
    where: { boardId_userId: { boardId, userId: target.id } },
  });
  if (existing) throw new ConflictError("이미 보드 멤버입니다.");
  return toDto(await db.membership.create({ data: { boardId, userId: target.id, role }, include }));
}

/** 보드마다 ADMIN이 1명 이상이어야 한다 (FR-020). 트랜잭션 안에서 재검사한다. */
export async function changeRole(
  user: Actor,
  boardId: string,
  targetUserId: string,
  payload: unknown,
): Promise<MemberDto> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  const { role } = parse(roleChangeSchema, payload);

  return db.$transaction(async (tx) => {
    // 같은 보드의 관리자 행을 잠가 동시 강등으로 관리자가 0명이 되는 경쟁을 막는다
    const admins = await tx.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "Membership" WHERE "boardId" = ${boardId} AND role = 'ADMIN' FOR UPDATE`;
    const current = await tx.membership.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
    if (!current) throw new NotFoundError("보드 멤버가 아닙니다.");
    const demotingLastAdmin =
      current.role === "ADMIN" && role !== "ADMIN" && admins.length <= 1;
    if (demotingLastAdmin) throw new ConflictError("마지막 관리자는 강등할 수 없습니다.");
    return toDto(
      await tx.membership.update({
        where: { boardId_userId: { boardId, userId: targetUserId } },
        data: { role },
        include,
      }),
    );
  });
}
