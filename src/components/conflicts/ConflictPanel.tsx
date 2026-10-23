import { WarningCard } from "@/components/conflicts/WarningCard";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { ConflictView } from "@/server/services/conflict-view";

const FAILURE_REASONS: Record<string, string> = {
  REFUSED: "AI가 요청을 처리하지 못했습니다.",
  INVALID_OUTPUT: "AI 결과가 형식 규칙을 통과하지 못했습니다.",
  API_ERROR: "AI 호출에 실패했습니다.",
  TIMEOUT: "AI 응답이 지연되었습니다.",
  TOO_LARGE: "비교할 spec이나 입력이 너무 커서 검사하지 못했습니다.",
};

function Status({ c }: { c: ConflictView }) {
  switch (c.state) {
    case "CHECKING":
      return <Badge tone="src" icon="refresh">충돌 검사 중</Badge>;
    case "FAILED":
      return <Badge tone="no" icon="warn">검사 실패</Badge>;
    case "SKIPPED":
      return (
        <Badge tone="neutral" icon="doc">
          {c.skipReason === "NO_ITEMS" ? "비교할 항목 없음" : "비교할 spec 없음"} · 경고 없음
        </Badge>
      );
    default:
      return c.warnings.length === 0 ? (
        <Badge tone="ok" icon="check">충돌 가능성 없음</Badge>
      ) : (
        <Badge tone="wait" icon="warn">충돌 가능성 {c.warnings.length}</Badge>
      );
  }
}

/** 입력 카드 안의 충돌 검사 상태와 경고 목록. 관리자에게만 렌더링된다(서버가 conflict를 관리자에게만 내려준다). */
export function ConflictPanel({
  conflict,
  content,
  renderWarningActions,
  actions,
}: {
  conflict: ConflictView | null | undefined;
  content: string;
  /** 경고별 동작(확인함) 슬롯 */
  renderWarningActions?: (warningId: string) => React.ReactNode;
  /** 패널 전체 동작(다시 검사) 슬롯 */
  actions?: React.ReactNode;
}) {
  if (!conflict) return null;
  const unacknowledged = conflict.unacknowledgedCount;
  return (
    <section className="conflict-panel stack" style={{ gap: 8 }} aria-label="충돌 검사" data-state={conflict.state}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 8 }}>
          <Status c={conflict} />
          {conflict.processedAs && (
            <Badge tone="outline" icon="check">처리됨({conflict.processedAs === "APPROVED" ? "승인됨" : "반려됨"})</Badge>
          )}
          {conflict.baseVersion && <span className="meta mono">v{conflict.baseVersion} 기준</span>}
          {conflict.state === "DONE" && conflict.warnings.length > 0 && unacknowledged < conflict.warnings.length && (
            <span className="meta">미확인 {unacknowledged}</span>
          )}
        </div>
        {actions}
      </div>
      {conflict.state === "CHECKING" && <div className="progress" role="progressbar" aria-label="충돌 검사 진행 중" />}
      {conflict.state === "FAILED" && (
        <p className="small error-text" role="status">
          <Icon name="warn" size={14} /> {FAILURE_REASONS[conflict.failure?.code ?? ""] ?? "충돌 검사에 실패했습니다."}{" "}
          입력의 승인·반려에는 영향이 없습니다. (시도 {conflict.failure?.attempts ?? 0}회)
        </p>
      )}
      {conflict.stale && conflict.currentSpecVersion && !conflict.processedAs && (
        <p className="small meta" role="status">
          <Icon name="clock" size={13} /> 검사 이후 spec이 새 버전(v{conflict.currentSpecVersion})으로 갱신되었습니다. 최신 spec 기준으로 다시 검사할 수 있습니다.
        </p>
      )}
      {conflict.processedAs && conflict.warnings.length > 0 ? (
        // 처리된 입력의 경고는 이력으로 남고 기본은 접혀 있다
        <details className="stack" style={{ gap: 8 }}>
          <summary className="small" style={{ cursor: "pointer" }}>
            경고 {conflict.warnings.length}개 보기 (처리됨 · {conflict.processedAs === "APPROVED" ? "승인됨" : "반려됨"})
          </summary>
          {conflict.warnings.map((w) => (
            <WarningCard key={w.id} warning={w} content={content} />
          ))}
        </details>
      ) : (
        conflict.warnings.map((w) => (
          <WarningCard key={w.id} warning={w} content={content} actions={renderWarningActions?.(w.id)} />
        ))
      )}
    </section>
  );
}
