import type { SourceRef } from "@/server/services/spec-view";

const KIND_LABEL = { MEETING_NOTE: "회의록", IDEA: "아이디어", OPINION: "의견" } as const;

/** 근거 입력 목록. details 요소로 클릭 한 번에 펼쳐 원문을 확인한다. */
export function SourceList({ sources, label = "출처" }: { sources: SourceRef[]; label?: string }) {
  return (
    <details className="sources">
      <summary>
        {label} {sources.length}개 보기
      </summary>
      <ul>
        {sources.map((s) => (
          <li key={s.inputId}>
            <span className="badge">{KIND_LABEL[s.kind]}</span>{" "}
            <span className="meta">
              {s.submitterName} · {new Date(s.submittedAt).toLocaleString("ko-KR")}
            </span>
            <pre>{s.content}</pre>
          </li>
        ))}
      </ul>
    </details>
  );
}
