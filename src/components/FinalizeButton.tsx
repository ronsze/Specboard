"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 관리자 전용 확정·해제 버튼. 확정은 확인 단계를 거친다. */
export function FinalizeButton({
  boardId,
  featureId,
  finalized,
}: {
  boardId: string;
  featureId: string;
  finalized: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call() {
    setError(null);
    const action = finalized ? "unfinalize" : "finalize";
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/${action}`, { method: "POST" });
    setConfirming(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "요청에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  if (finalized) {
    return (
      <span>
        <button onClick={call}>확정 해제</button>
        {error && <span className="error" role="alert"> {error}</span>}
      </span>
    );
  }
  return (
    <span>
      {!confirming ? (
        <button onClick={() => setConfirming(true)}>spec 확정</button>
      ) : (
        <span className="row">
          <span>확정하면 새 입력이 승인되어도 spec이 바뀌지 않습니다.</span>
          <button onClick={call}>확정</button>
          <button onClick={() => setConfirming(false)}>취소</button>
        </span>
      )}
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
