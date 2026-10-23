import Link from "next/link";
import { pageContext } from "@/server/auth/page-context";
import { listInputs } from "@/server/services/inputs";
import { InputCard } from "@/components/InputCard";
import { SubmitInputForm } from "@/components/SubmitInputForm";

export default async function InputsPage({
  params,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  const { user, role, board } = await pageContext(boardId);
  const inputs = await listInputs(user, boardId, featureId);

  return (
    <main>
      <nav>
        <Link href="/">← {board.name}</Link>
        <span className="spacer" />
        {role === "ADMIN" && <Link href={`/boards/${boardId}/features/${featureId}/inputs/pending`}>승인 대기</Link>}
        <span className="badge">{role}</span>
      </nav>
      <h1>입력</h1>
      {role !== "VIEWER" && <SubmitInputForm boardId={boardId} featureId={featureId} />}
      {inputs.length === 0 && <p>아직 입력이 없습니다.</p>}
      {inputs.map((i) => (
        <InputCard key={i.id} input={i} />
      ))}
    </main>
  );
}
