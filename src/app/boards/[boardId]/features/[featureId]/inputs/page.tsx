import Link from "next/link";
import { InputCard } from "@/components/inputs/InputCard";
import { InputFilters } from "@/components/inputs/InputFilters";
import { SubmitInputForm } from "@/components/inputs/SubmitInputForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { pageContext } from "@/server/auth/page-context";
import { INPUT_FILTERS, listInputsView, type InputFilter } from "@/server/services/inputs";

export const metadata = { title: "입력" };

const STEP = 20;

export default async function InputsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
  searchParams: Promise<{ filter?: string; limit?: string }>;
}) {
  const { boardId, featureId } = await params;
  const q = await searchParams;
  const { user, role } = await pageContext(boardId);
  const filter = (INPUT_FILTERS as readonly string[]).includes(q.filter ?? "") ? (q.filter as InputFilter) : "all";
  const limit = Math.min(Math.max(Number(q.limit) || STEP, STEP), 100);
  const view = await listInputsView(user, boardId, featureId, { filter, limit });

  const base = `/boards/${boardId}/features/${featureId}/inputs`;
  const total = { all: view.counts.all, "mine-pending": view.counts.minePending, "reflect-pending": view.counts.reflectPending, rejected: view.counts.rejected }[filter];
  const remaining = Math.max(0, total - view.inputs.length);
  const query = (n: number) => `${base}?${filter === "all" ? "" : `filter=${filter}&`}limit=${n}`;

  return (
    <div className="two-col" style={{ display: "grid", gridTemplateColumns: role === "VIEWER" ? "minmax(0,1fr)" : "340px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
      {role !== "VIEWER" && <SubmitInputForm boardId={boardId} featureId={featureId} />}
      <section className="stack" aria-label="입력 목록">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>
            입력 <span className="meta mono">{view.counts.all}</span>
          </h2>
          <InputFilters base={base} current={filter} counts={view.counts} />
        </div>
        {view.inputs.length === 0 ? (
          filter === "all" ? (
            <EmptyState icon="chat" title="아직 입력이 없습니다" actions={role !== "VIEWER" ? <ButtonLink href="#submit" variant="primary">첫 입력 제출</ButtonLink> : undefined}>
              회의록, 아이디어 한 줄, 의견 무엇이든 괜찮습니다. 첫 입력이 spec의 출발점이 됩니다.
            </EmptyState>
          ) : (
            <EmptyState icon="chat" title="조건에 맞는 입력이 없습니다" actions={<ButtonLink href={base} variant="secondary">전체 보기</ButtonLink>} />
          )
        ) : (
          view.inputs.map((input) => <InputCard key={input.id} input={input} />)
        )}
        {remaining > 0 && (
          <p style={{ textAlign: "center" }}>
            <Link href={query(limit + STEP)} className="btn btn--secondary">
              이전 입력 {remaining}개 더 보기
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
