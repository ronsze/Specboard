"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** 경고를 확인했다고 닫는다. 승인·반려와는 별개이며 입력 상태는 바뀌지 않는다. */
export function AcknowledgeButton({ boardId, warningId }: { boardId: string; warningId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/conflict-warnings/${warningId}/acknowledge`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "확인 처리에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="row" style={{ justifyContent: "flex-end" }}>
      {error && <span className="error-text small" role="alert">{error}</span>}
      <Button variant="secondary" small onClick={run} disabled={busy}>
        <Icon name="check" size={14} /> 확인함
      </Button>
    </div>
  );
}

/** 실패했거나 낡은 검사를 최신 spec 기준으로 다시 시도한다 (관리자 전용). */
export function RecheckButton({ boardId, inputId }: { boardId: string; inputId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/inputs/${inputId}/conflict-check/retry`, { method: "POST" });
    setBusy(false);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "다시 검사하지 못했습니다.");
    router.refresh();
  }

  return (
    <span className="row">
      {error && <span className="error-text small" role="alert">{error}</span>}
      <Button variant="secondary" small onClick={run} disabled={busy}>
        <Icon name="refresh" size={14} /> 다시 검사
      </Button>
    </span>
  );
}
