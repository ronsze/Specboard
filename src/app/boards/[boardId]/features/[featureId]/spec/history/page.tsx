import Link from "next/link";
import { pageContext } from "@/server/auth/page-context";
import { diff, getSpec, listVersions } from "@/server/services/spec";
import { RevertButton } from "@/components/RevertButton";
import { db } from "@/server/db/client";

const KIND_LABEL = { AI_UPDATE: "AI 갱신", REVERT: "되돌림" } as const;
const CHANGE_LABEL = { ADDED: "추가", REMOVED: "삭제", CHANGED: "변경" } as const;
const CHANGE_MARK = { ADDED: "+", REMOVED: "−", CHANGED: "~" } as const;

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { boardId, featureId } = await params;
  const q = await searchParams;
  const { user, role } = await pageContext(boardId);
  const versions = await listVersions(user, boardId, featureId);
  const spec = await getSpec(user, boardId, featureId);

  const from = Number(q.from);
  const to = Number(q.to);
  const result =
    Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= 1
      ? await diff(user, boardId, featureId, from, to).catch(() => null)
      : null;

  const inputs = await db.input.findMany({
    where: { id: { in: versions.flatMap((v) => v.inputIds) } },
    select: { id: true, content: true, submitterName: true },
  });
  const inputById = new Map(inputs.map((i) => [i.id, i]));

  return (
    <main>
      <nav>
        <Link href={`/boards/${boardId}/features/${featureId}/spec`}>← spec</Link>
        <span className="spacer" />
        <span className="badge">{role}</span>
      </nav>
      <h1>버전 이력</h1>
      {versions.length === 0 && <p className="meta">아직 버전이 없습니다.</p>}

      {versions.length >= 2 && (
        <form method="get" className="card row" aria-label="버전 비교">
          <label>
            이전{" "}
            <select name="from" defaultValue={q.from ?? String(versions[1].number)}>
              {versions.map((v) => (
                <option key={v.number} value={v.number}>v{v.number}</option>
              ))}
            </select>
          </label>
          <label>
            이후{" "}
            <select name="to" defaultValue={q.to ?? String(versions[0].number)}>
              {versions.map((v) => (
                <option key={v.number} value={v.number}>v{v.number}</option>
              ))}
            </select>
          </label>
          <button type="submit">비교</button>
        </form>
      )}

      {result && (
        <section aria-label="비교 결과" className="card">
          <h2>
            v{result.from} → v{result.to}
          </h2>
          {result.items.length === 0 && result.questions.length === 0 && <p className="meta">차이가 없습니다.</p>}
          {[...result.items.map((c) => ({ ...c, scope: "항목" })), ...result.questions.map((c) => ({ ...c, scope: "질문" }))].map(
            (c) => (
              <div key={`${c.scope}-${c.key}`} className={`diff ${c.change}`}>
                <strong>
                  {CHANGE_MARK[c.change]} {CHANGE_LABEL[c.change]} · {c.scope}
                </strong>
                {c.before && <pre className="before">{c.before}</pre>}
                {c.after && <pre className="after">{c.after}</pre>}
              </div>
            ),
          )}
        </section>
      )}

      {versions.map((v) => (
        <article key={v.number} className="card" data-version={v.number}>
          <div className="row">
            <strong>v{v.number}</strong>
            <span className="badge">{KIND_LABEL[v.kind]}</span>
            {v.kind === "REVERT" && <span className="meta">버전 {v.revertedFromNumber}로 되돌림 · {v.createdByName}</span>}
            <span className="meta">{new Date(v.createdAt).toLocaleString("ko-KR")}</span>
          </div>
          {role === "ADMIN" && v.number !== versions[0].number && (
            <RevertButton
              boardId={boardId}
              featureId={featureId}
              version={v.number}
              disabledReason={spec.status === "FINALIZED" ? "확정 상태에서는 되돌릴 수 없습니다. 먼저 확정을 해제하세요." : undefined}
            />
          )}
          {v.inputIds.length > 0 && (
            <ul className="meta">
              {v.inputIds.map((id) => (
                <li key={id}>
                  {inputById.get(id)?.submitterName}: {(inputById.get(id)?.content ?? "").slice(0, 80)}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </main>
  );
}
