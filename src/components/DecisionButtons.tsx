"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DecisionButtons({ boardId, inputId }: { boardId: string; inputId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function call(action: "approve" | "reject") {
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/inputs/${inputId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "reject" ? { reason } : {}),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "처리에 실패했습니다.");
      if (res.status === 409) router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {!rejecting ? (
        <div className="row">
          <button onClick={() => call("approve")}>승인</button>
          <button onClick={() => setRejecting(true)}>반려</button>
        </div>
      ) : (
        <div>
          <textarea aria-label="반려 사유" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row">
            <button onClick={() => call("reject")}>반려 확정</button>
            <button onClick={() => setRejecting(false)}>취소</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
