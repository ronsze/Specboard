"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 관리자 전용. 확인 단계를 거쳐 클릭 세 번 이내에 되돌린다 (버튼 → 확인 → 완료). */
export function RevertButton({
  boardId,
  featureId,
  version,
  disabledReason,
}: {
  boardId: string;
  featureId: string;
  version: number;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revert() {
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/revert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toVersion: version }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "되돌리기에 실패했습니다.");
      setConfirming(false);
      return;
    }
    router.push(`/boards/${boardId}/features/${featureId}/spec`);
    router.refresh();
  }

  if (disabledReason) return <span className="meta">{disabledReason}</span>;
  return (
    <span>
      {!confirming ? (
        <button onClick={() => setConfirming(true)}>이 버전으로 되돌리기</button>
      ) : (
        <span className="row">
          <span>v{version}의 내용으로 새 버전을 만듭니다. 기존 버전은 모두 보존됩니다.</span>
          <button onClick={revert}>되돌리기 확정</button>
          <button onClick={() => setConfirming(false)}>취소</button>
        </span>
      )}
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
