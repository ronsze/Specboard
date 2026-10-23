import Link from "next/link";
import { SourceToggle } from "@/components/spec/SourceToggle";
import { InputKindBadge, QuestionStatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatShort } from "@/lib/format";
import { inputLabel } from "@/lib/labels";
import type { QuestionView } from "@/server/services/spec-view";

function QuestionCard({ q, inputsBase }: { q: QuestionView; inputsBase: string }) {
  return (
    <article className="q-card" id={q.label} aria-label={`${q.label} ${q.text}`}>
      <div className="row">
        <QuestionStatusBadge status={q.status} />
        <span className="id">{q.label}</span>
        {q.status === "RESOLVED" && q.resolvedInVersion && <span className="meta">v{q.resolvedInVersion}에서 해소</span>}
      </div>
      <p>{q.text}</p>
      {q.status === "OPEN" && q.sources.length === 0 && <p className="meta">관련 입력 없음</p>}
      {q.status === "RESOLVED" && q.resolvedBy && (
        <Link
          href={`${inputsBase}#${inputLabel(q.resolvedBy.number)}`}
          className="chip"
          aria-label={`답이 된 입력 ${inputLabel(q.resolvedBy.number)}`}
        >
          <Icon name="doc" size={14} />
          답이 된 입력 · {inputLabel(q.resolvedBy.number)} <InputKindBadge kind={q.resolvedBy.kind} /> {q.resolvedBy.submitterName}
          <span className="mono">{formatShort(q.resolvedBy.submittedAt)}</span>
        </Link>
      )}
      {q.sources.length > 0 && (
        <div className="row">
          <SourceToggle sources={q.sources} inputsBase={inputsBase} label="질문 출처" />
        </div>
      )}
    </article>
  );
}

/** 오른쪽(좁은 화면에서는 위) 미결 질문 영역. 항목과 시각적으로 구별한다. */
export function QuestionRail({
  questions,
  inputsBase,
  canSubmit,
}: {
  questions: QuestionView[];
  inputsBase: string;
  canSubmit: boolean;
}) {
  const open = questions.filter((q) => q.status === "OPEN");
  const resolved = questions.filter((q) => q.status === "RESOLVED");
  return (
    <section id="questions" className="card card--q stack" aria-labelledby="questions-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="questions-title" style={{ color: "var(--ink)" }}>
          <Icon name="question" size={18} /> 미결 질문
        </h2>
        <span className="small" style={{ color: "var(--q)", fontWeight: 600 }}>
          열림 {open.length} · 해소 {resolved.length}
        </span>
      </div>
      <p className="meta">
        승인된 입력만으로는 근거가 부족해 AI가 단정하지 않은 내용입니다. 답이 되는 입력이 승인되면 다음 버전에서 해소됩니다.
      </p>
      {questions.length === 0 && <p className="small">지금은 미결 질문이 없습니다.</p>}
      {open.map((q) => (
        <QuestionCard key={q.key} q={q} inputsBase={inputsBase} />
      ))}
      {resolved.length > 0 && <div className="divider">해소됨</div>}
      {resolved.map((q) => (
        <QuestionCard key={q.key} q={q} inputsBase={inputsBase} />
      ))}
      {canSubmit && (
        <ButtonLink href={`${inputsBase}#submit`} variant="secondary">
          질문에 답하는 입력 제출
        </ButtonLink>
      )}
    </section>
  );
}
