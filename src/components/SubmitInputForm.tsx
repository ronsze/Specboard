"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const KINDS = [
  { value: "MEETING_NOTE", label: "회의록" },
  { value: "IDEA", label: "아이디어" },
  { value: "OPINION", label: "의견" },
];

export function SubmitInputForm({ boardId, featureId }: { boardId: string; featureId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/inputs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: data.get("kind"), content: data.get("content") }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "제출에 실패했습니다.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card" aria-label="입력 제출">
      <label>
        종류
        <select name="kind" defaultValue="IDEA">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        내용
        <textarea name="content" rows={4} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>제출</button>
    </form>
  );
}
