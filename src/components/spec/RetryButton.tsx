"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RetryButton({ boardId, featureId }: { boardId: string; featureId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/retry`, { method: "POST" });
    setBusy(false);
    if (!res.ok) setError((await res.json()).error ?? "재시도에 실패했습니다.");
    router.refresh();
  }

  return (
    <span>
      <Button variant="primary" onClick={retry} disabled={busy}>AI 갱신 다시 시도</Button>
      {error && <span className="error-text" role="alert"> {error}</span>}
    </span>
  );
}
