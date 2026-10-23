import type { QuestionView } from "@/server/services/spec-view";
import { SourceList } from "@/components/SourceList";

const KIND_LABEL = { MEETING_NOTE: "회의록", IDEA: "아이디어", OPINION: "의견" } as const;

export function OpenQuestionList({ questions }: { questions: QuestionView[] }) {
  if (questions.length === 0) return null;
  return (
    <section aria-label="미결 질문">
      <h2>미결 질문</h2>
      {questions.map((q) => (
        <article key={q.key} className="card question" data-status={q.status}>
          <span className={`badge ${q.status === "OPEN" ? "PENDING" : "APPROVED"}`}>
            {q.status === "OPEN" ? "열림" : "해소"}
          </span>
          <pre>{q.text}</pre>
          {q.resolvedBy && (
            <div className="meta">
              답: {KIND_LABEL[q.resolvedBy.kind]} · {q.resolvedBy.submitterName} ·{" "}
              {new Date(q.resolvedBy.submittedAt).toLocaleString("ko-KR")}
            </div>
          )}
          <SourceList sources={q.sources} label="질문 출처" />
        </article>
      ))}
    </section>
  );
}
