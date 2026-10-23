import { after } from "next/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ItemCard } from "@/components/spec/ItemCard";
import { QuestionRail } from "@/components/spec/QuestionRail";
import { RecentVersions } from "@/components/spec/RecentVersions";
import { SpecHeaderCard } from "@/components/spec/SpecHeaderCard";
import { StatusBanners } from "@/components/spec/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { pageContext } from "@/server/auth/page-context";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";

export const metadata = { title: "Spec" };

export default async function SpecPage({
  params,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  const { user, role } = await pageContext(boardId);
  const spec = await getSpec(user, boardId, featureId);
  // 멈춘 갱신(프로세스 재시작 등)이 있으면 이어서 처리한다
  if (spec.status === "UPDATING") after(() => drainSpecJobs(featureId).catch(console.error));

  const base = `/boards/${boardId}/features/${featureId}`;
  const inputsBase = `${base}/inputs`;
  const version = spec.version;
  const noItems = version && version.items.length === 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <AutoRefresh active={spec.status === "UPDATING"} />
      <SpecHeaderCard spec={spec} role={role} boardId={boardId} featureId={featureId} />
      <StatusBanners spec={spec} role={role} boardId={boardId} featureId={featureId} />

      {version && (
        <div className="split">
          <section aria-label="spec 항목" className="stack">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2>
                항목{" "}
                <span className="meta" style={{ fontWeight: 400 }}>
                  결정 {version.counts.decisions} · 요구사항 {version.counts.requirements}
                </span>
              </h2>
              <p className="small row" style={{ gap: 12 }} aria-label="범례">
                <span><span className="badge badge--ai"><Icon name="lines" size={12} /> AI 정리</span> 승인된 입력만으로 정리</span>
                <span><span className="badge badge--src"><Icon name="doc" size={12} /> 출처</span> 근거가 된 원문</span>
                <span><span className="badge badge--q"><Icon name="question" size={12} /> 미결</span> 근거 부족, 단정하지 않음</span>
              </p>
            </div>
            {noItems ? (
              <EmptyState
                icon="question"
                title="아직 단정할 수 있는 항목이 없습니다"
              >
                승인된 입력만으로는 결정·요구사항을 확정할 근거가 부족해, AI가 미결 질문 {version.questions.length}개만 남겼습니다.
              </EmptyState>
            ) : (
              version.items.map((item) => <ItemCard key={item.key} item={item} inputsBase={inputsBase} />)
            )}
          </section>
          <aside className="rail" aria-label="미결 질문과 최근 버전">
            <QuestionRail questions={version.questions} inputsBase={inputsBase} canSubmit={role !== "VIEWER"} />
            <RecentVersions versions={spec.recentVersions} historyHref={`${base}/spec/history`} />
          </aside>
        </div>
      )}
    </div>
  );
}
