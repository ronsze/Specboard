"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryButton({ boardId, featureId }: { boardId: string; featureId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/retry`, { method: "POST" });
    if (!res.ok) setError((await res.json()).error ?? "재시도에 실패했습니다.");
    router.refresh();
  }

  return (
    <span>
      <button onClick={retry}>다시 시도</button>
      {error && <span className="error" role="alert"> {error}</span>}
    </span>
  );
}
