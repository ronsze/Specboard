import { AppHeader } from "@/components/layout/AppHeader";
import { pageContext } from "@/server/auth/page-context";
import { countBoardPending } from "@/server/services/board-pending";
import { getNavTree } from "@/server/services/nav";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const { user, role } = await pageContext(boardId);
  const tree = await getNavTree(user.id);
  const pendingCount = role === "ADMIN" ? await countBoardPending(user, boardId) : null;
  return (
    <>
      <AppHeader userName={user.displayName} tree={tree} board={{ id: boardId, role, pendingCount }} />
      {children}
    </>
  );
}
