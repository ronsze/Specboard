import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/server/auth/page-context";
import { listPendingInputs } from "@/server/services/inputs";
import { InputCard } from "@/components/InputCard";
import { DecisionButtons } from "@/components/DecisionButtons";

export default async function PendingPage({
  params,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  const { user, role } = await pageContext(boardId);
  if (role !== "ADMIN") notFound();
  const inputs = await listPendingInputs(user, boardId, featureId);

  return (
    <main>
      <nav>
        <Link href={`/boards/${boardId}/features/${featureId}/inputs`}>← 입력 목록</Link>
      </nav>
      <h1>승인 대기 ({inputs.length})</h1>
      {inputs.length === 0 && <p>대기 중인 입력이 없습니다.</p>}
      {inputs.map((i) => (
        <InputCard key={i.id} input={i} actions={<DecisionButtons boardId={boardId} inputId={i.id} />} />
      ))}
    </main>
  );
}
