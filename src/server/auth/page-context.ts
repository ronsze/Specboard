import type { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth/session";
import { db } from "@/server/db/client";

/** 페이지용: 로그인과 보드 멤버십을 확인한다. 비로그인은 /login, 비멤버는 404. */
export async function pageContext(boardId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, displayName: session.user.name ?? session.user.email ?? "" };
  const membership = await db.membership.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
    include: { board: true },
  });
  if (!membership) notFound();
  return { user, role: membership.role as Role, board: membership.board };
}
