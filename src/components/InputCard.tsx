import type { InputDto } from "@/server/services/inputs";

const KIND_LABEL = { MEETING_NOTE: "회의록", IDEA: "아이디어", OPINION: "의견" } as const;
const STATUS_LABEL = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려" } as const;

export function InputCard({ input, actions }: { input: InputDto; actions?: React.ReactNode }) {
  return (
    <article className="card" data-status={input.status}>
      <div className="row">
        <span className={`badge ${input.status}`}>{STATUS_LABEL[input.status]}</span>
        <span className="badge">{KIND_LABEL[input.kind]}</span>
        {input.autoApproved && <span className="badge">자동 승인</span>}
        {input.status === "APPROVED" && (
          <span className="badge">{input.reflectedInSpec ? "spec 반영됨" : "반영 대기"}</span>
        )}
      </div>
      <pre>{input.content}</pre>
      <div className="meta">
        {input.submitterName} · {new Date(input.submittedAt).toLocaleString("ko-KR")}
      </div>
      {input.status === "APPROVED" && input.decidedByName && !input.autoApproved && (
        <div className="meta">
          승인: {input.decidedByName} · {new Date(input.decidedAt!).toLocaleString("ko-KR")}
        </div>
      )}
      {input.status === "REJECTED" && (
        <div className="meta">
          반려: {input.decidedByName} · {new Date(input.decidedAt!).toLocaleString("ko-KR")}
          <br />
          사유: {input.rejectionReason}
        </div>
      )}
      {actions}
    </article>
  );
}
