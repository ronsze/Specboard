import { AppHeader } from "@/components/layout/AppHeader";
import { pageContext } from "@/server/auth/page-context";
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
  // 승인 대기 개수는 보드 단위 승인 대기 서비스(T056)가 생기면 연결한다
  return (
    <>
      <AppHeader userName={user.displayName} tree={tree} board={{ id: boardId, role, pendingCount: null }} />
      {children}
    </>
  );
}
