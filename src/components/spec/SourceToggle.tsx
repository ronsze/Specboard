"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { QuoteText } from "@/components/spec/QuoteText";
import { InputKindBadge, InputStatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatShort } from "@/lib/format";
import { inputLabel } from "@/lib/labels";
import type { SourceRef } from "@/server/services/spec-view";

/**
 * "출처 N" 칩과 펼침 패널. 첫 클릭에 근거 입력과 강조된 발췌가 보이고,
 * "원문 전체 보기"로 입력 화면의 해당 입력으로 이동한다(두 번째 클릭).
 */
export function SourceToggle({
  sources,
  inputsBase,
  label = "출처",
  defaultOpen = false,
}: {
  sources: SourceRef[];
  inputsBase: string;
  label?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <>
      <button
        type="button"
        className="chip"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="doc" size={14} />
        {label} {sources.length}
        <Icon name={open ? "chevronUp" : "chevron"} size={14} />
      </button>
      {open && (
        <div id={panelId} className="source-panel" role="region" aria-label={`${label} ${sources.length}개`}>
          {sources.map((s, index) => (
            <div key={s.inputId} className="source">
              <div className="row">
                <span className="id">[{index + 1}]</span>
                <span className="id" style={{ color: "var(--src)", fontWeight: 600 }}>{inputLabel(s.number)}</span>
                <InputKindBadge kind={s.kind} />
                <strong>{s.submitterName}</strong>
                <span className="meta mono">{formatShort(s.submittedAt)} 제출</span>
                <InputStatusBadge status={s.status} />
              </div>
              <QuoteText content={s.content} quote={s.quote} />
              <Link href={`${inputsBase}#${inputLabel(s.number)}`}>원문 전체 보기 ({inputLabel(s.number)})</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
