import { ConflictPanel } from "@/components/conflicts/ConflictPanel";
import { ExpandableText } from "@/components/inputs/ExpandableText";
import { InputKindBadge, InputStatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatShort } from "@/lib/format";
import { inputLabel } from "@/lib/labels";
import type { ConflictView } from "@/server/services/conflict-view";
import type { InputDto } from "@/server/services/inputs";

function Reflection({ input }: { input: InputDto }) {
  if (input.status === "REJECTED") return <span className="meta">spec에 쓰이지 않음</span>;
  if (input.status === "PENDING") {
    return (
      <span className="meta">
        <Icon name="eye" size={13} /> {input.isMine ? "나와 관리자에게만 보임" : "제출자와 관리자에게만 보임"}
      </span>
    );
  }
  return input.reflectedInSpec ? (
    <span className="meta">
      <Icon name="dot" size={10} /> {input.reflectedVersion ? `v${input.reflectedVersion}에 반영됨` : "spec에 반영됨"}
    </span>
  ) : (
    <span className="meta">
      <Icon name="circle" size={10} /> 반영 대기
    </span>
  );
}

/** 입력 한 건: 번호, 종류, 상태, 제출자, 원문(편집 없이 그대로), 승인·반려 기록. */
export function InputCard({
  input,
  actions,
  headerRight,
  conflict,
  conflictSlots,
}: {
  input: InputDto;
  /** 관리자 화면에서만 전달된다 (비관리자 호출에는 없음) */
  conflict?: ConflictView | null;
  conflictSlots?: { renderWarningActions?: (warningId: string) => React.ReactNode; actions?: React.ReactNode };
  actions?: React.ReactNode;
  /** 기본의 반영 상태 표시를 대신할 오른쪽 위 내용 (예: 승인 대기 화면의 feature 링크) */
  headerRight?: React.ReactNode;
}) {
  const label = inputLabel(input.number);
  return (
    <article
      id={label}
      className={`card input-card ${input.status === "PENDING" ? "card--dashed" : ""}`}
      data-status={input.status}
      aria-label={`${label} ${input.submitterName}`}
    >
      <div className="input-card__head">
        <InputKindBadge kind={input.kind} />
        <InputStatusBadge status={input.status} auto={input.autoApproved} />
        <span className="id">{label}</span>
        <span className="spacer" />
        {headerRight ?? <Reflection input={input} />}
      </div>
      <div className="row">
        <Icon name="person" size={14} />
        <strong>
          {input.submitterName}
          {input.isMine && " (나)"}
        </strong>
        <span className="meta mono">{formatShort(input.submittedAt)}</span>
      </div>
      <ExpandableText text={input.content} />
      {input.status === "APPROVED" && input.decidedByName && (
        <p className="meta">
          {input.autoApproved ? "관리자 제출 · 자동 승인" : `승인 ${input.decidedByName}`} ·{" "}
          <span className="mono">{formatShort(input.decidedAt!)}</span>
        </p>
      )}
      {input.status === "REJECTED" && (
        <div className="reject-box">
          <div className="reject-box__title">
            <Icon name="x" size={14} /> 반려 사유
          </div>
          <p>{input.rejectionReason}</p>
          <p className="meta" style={{ marginTop: 4 }}>
            반려 {input.decidedByName} · <span className="mono">{input.decidedAt && formatShort(input.decidedAt)}</span>
          </p>
        </div>
      )}
      {conflict && (
        <ConflictPanel
          conflict={conflict}
          content={input.content}
          renderWarningActions={conflictSlots?.renderWarningActions}
          actions={conflictSlots?.actions}
        />
      )}
      {actions}
    </article>
  );
}
