"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const KINDS = [
  { value: "MEETING_NOTE", label: "회의록" },
  { value: "IDEA", label: "아이디어" },
  { value: "OPINION", label: "의견" },
];
const MAX = 50_000;

/** 입력 제출 폼: 종류 선택, 글자 수 카운터, 제출 후 흐름 안내. */
export function SubmitInputForm({ boardId, featureId }: { boardId: string; featureId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("MEETING_NOTE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const counterId = useId();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/inputs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, content: text }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "제출에 실패했습니다.");
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card stack" id="submit" aria-label="입력 제출">
      <h2>입력 제출</h2>
      <fieldset className="segmented" aria-label="종류">
        {KINDS.map((k) => (
          <label key={k.value}>
            <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} />
            <span>{k.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="content" className="field__label">본문</label>
        <textarea
          id="content"
          name="content"
          className="textarea"
          rows={10}
          value={text}
          placeholder="회의에서 정한 내용, 아이디어 한 줄, 의견 등을 그대로 적어 주세요."
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${counterId}${error ? ` ${errorId}` : ""}`}
        />
        <div className="row" style={{ justifyContent: "space-between" }} id={counterId}>
          <span className="field__hint">한 줄부터 긴 회의록까지 붙여넣을 수 있어요.</span>
          <span className={`mono ${text.length > MAX ? "error-text" : "meta"}`}>
            {text.length.toLocaleString("ko-KR")} / {MAX.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
      {error && (
        <p className="error-text" role="alert" id={errorId}>
          <Icon name="warn" size={14} /> {error}
        </p>
      )}
      <div className="banner" style={{ background: "var(--mute-bg)", border: 0 }}>
        <div className="small">
          <strong>제출 후 흐름</strong>
          <br />
          대기 → 관리자가 승인하면 다음 AI 갱신에 spec 재료로 쓰입니다. 원문은 수정되지 않고 그대로 출처로 남습니다.
        </div>
      </div>
      <Button variant="primary" type="submit" disabled={busy}>제출하기</Button>
    </form>
  );
}
