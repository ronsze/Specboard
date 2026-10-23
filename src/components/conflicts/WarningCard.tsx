import { QuoteText } from "@/components/spec/QuoteText";
import { ItemKindBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatShort } from "@/lib/format";
import type { WarningView } from "@/server/services/conflict-view";

/**
 * 충돌 경고 한 건. 확정된 spec과의 충돌은 잠금 아이콘과 "확정된 결정과 충돌 가능" 문구로,
 * 그렇지 않은 경고는 경고 아이콘과 "충돌 가능성" 문구로 구분한다(색뿐 아니라 아이콘·문구가 다르다).
 */
export function WarningCard({
  warning,
  content,
  actions,
}: {
  warning: WarningView;
  /** 입력 원문 (발췌 강조용) */
  content: string;
  actions?: React.ReactNode;
}) {
  const finalized = warning.onFinalizedSpec;
  const acknowledged = warning.acknowledged;
  const body = (
    <>
      <div className="row" style={{ gap: 8 }}>
        {finalized ? (
          <span className="warning__title warning__title--finalized">
            <Icon name="lock" size={15} /> 확정된 결정과 충돌 가능
          </span>
        ) : (
          <span className="warning__title">
            <Icon name="warn" size={15} /> 충돌 가능성
          </span>
        )}
        <ItemKindBadge kind={warning.kind} />
        <span className="id">{warning.label}</span>
      </div>
      <p className="warning__item">{warning.itemText}</p>
      <p className="small">
        <strong>이유</strong> {warning.reason}
      </p>
      {warning.quote && <QuoteText content={content} quote={warning.quote} />}
    </>
  );

  if (acknowledged) {
    return (
      <details className={`warning warning--ack ${finalized ? "warning--finalized" : ""}`} data-warning-id={warning.id}>
        <summary>
          <Icon name="check" size={14} /> 확인됨 · {warning.label} {warning.reason}
          <span className="meta mono"> · {acknowledged.byName} · {formatShort(acknowledged.at)}</span>
        </summary>
        <div className="stack" style={{ gap: 6, marginTop: 8 }}>{body}</div>
      </details>
    );
  }
  return (
    <article className={`warning ${finalized ? "warning--finalized" : ""}`} data-warning-id={warning.id} aria-label={`${warning.label} 충돌 경고`}>
      <div className="stack" style={{ gap: 6 }}>{body}</div>
      {actions}
    </article>
  );
}
