import { db } from "@/server/db/client";

export type NavTree = {
  id: string;
  name: string;
  projects: { id: string; name: string; features: { id: string; name: string }[] }[];
}[];

/** 브레드크럼 전환 메뉴용: 사용자가 속한 보드·프로젝트·feature 이름만 한 번에 읽는다. */
export async function getNavTree(userId: string): Promise<NavTree> {
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
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
  return memberships.map((m) => m.board);
}
