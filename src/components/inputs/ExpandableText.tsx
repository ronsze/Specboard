"use client";

import { useId, useState } from "react";

/** 긴 본문은 처음 몇 줄만 보여주고 전체 글자 수와 함께 펼치기를 제공한다. 원문은 가공하지 않는다. */
export function ExpandableText({ text }: { text: string }) {
  const long = text.length > 280 || text.split("\n").length > 7;
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <pre id={id} className={`input-card__body ${long && !open ? "input-card__body--clamped" : ""}`}>
        {text}
      </pre>
      {long && (
        <button
          type="button"
          className="btn btn--secondary btn--small"
          style={{ marginTop: 8 }}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "접기" : "펼치기"} <span className="meta mono">전체 {text.length.toLocaleString("ko-KR")}자</span>
        </button>
      )}
    </div>
  );
}
