"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** 승인 / 반려… 와 반려 사유 폼. 사유는 필수이며 제출자에게 그대로 보인다. */
export function ApprovalActions({ boardId, inputId }: { boardId: string; inputId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function call(action: "approve" | "reject") {
    if (action === "reject" && reason.trim().length === 0) {
      setError("반려 사유를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/inputs/${inputId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "reject" ? { reason } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(res.status === 409 ? "다른 관리자가 이미 처리한 입력입니다. 목록을 갱신합니다." : (body.error ?? "처리에 실패했습니다."));
      if (res.status === 409) router.refresh();
      return;
    }
    router.refresh();
  }

  if (!rejecting) {
    return (
      <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="danger-outline" onClick={() => setRejecting(true)}>반려…</Button>
          <Button variant="ok" onClick={() => call("approve")} disabled={busy}>
            <Icon name="check" size={16} /> 승인
          </Button>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="stack card--no" style={{ background: "var(--no-bg)", border: "1px solid var(--no)", borderRadius: 12, padding: 16 }}>
      <label className="field">
        <span className="field__label" style={{ color: "var(--no)" }}>
          반려 사유 (필수 · 제출자에게 보임)
        </span>
        <textarea
          className="textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      {error && <p className="error-text" role="alert" id={errorId}>{error}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="text" onClick={() => { setRejecting(false); setError(null); }}>취소</Button>
        <Button variant="danger" onClick={() => call("reject")} disabled={busy}>
          <Icon name="x" size={16} /> 반려 확정
        </Button>
      </div>
    </div>
  );
}
