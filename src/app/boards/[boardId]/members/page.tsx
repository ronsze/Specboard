import { ForbiddenView } from "@/components/ui/ForbiddenView";
import { MemberTable } from "@/components/members/MemberTable";
import { pageContext } from "@/server/auth/page-context";
import { listMembers } from "@/server/services/members";

export const metadata = { title: "멤버 관리" };

export default async function MembersPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const { user, role, board } = await pageContext(boardId);
  if (role !== "ADMIN") return <ForbiddenView role={role} what="멤버 관리" />;
  const members = await listMembers(user, boardId);

  return (
    <main className="container container--narrow stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Board · {board.name}</div>
          <h1>멤버 관리 <span className="meta" style={{ fontSize: 28 }}>{members.length}</span></h1>
        </div>
      </div>
      <MemberTable boardId={boardId} members={members} currentUserId={user.id} />
    </main>
  );
}
