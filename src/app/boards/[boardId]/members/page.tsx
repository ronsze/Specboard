import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/server/auth/page-context";
import { listMembers } from "@/server/services/members";
import { MemberManager } from "@/components/MemberManager";

export default async function MembersPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const { user, role, board } = await pageContext(boardId);
  if (role !== "ADMIN") notFound();
  const members = await listMembers(user, boardId);

  return (
    <main>
      <nav>
        <Link href="/">← {board.name}</Link>
      </nav>
      <h1>멤버 관리</h1>
      <MemberManager boardId={boardId} members={members} />
    </main>
  );
}
