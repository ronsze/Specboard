"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatShort } from "@/lib/format";

/** 관리자 전용 확정·해제 컨트롤. 두 동작 모두 확인 창을 거친다. */
export function LockControl({
  boardId,
  featureId,
  finalized,
  finalizedBy,
  finalizedAt,
  pendingCount,
}: {
  boardId: string;
  featureId: string;
  finalized: boolean;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  pendingCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/${finalized ? "unfinalize" : "finalize"}`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "요청에 실패했습니다.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {finalized ? "확정 해제" : "이 버전 확정"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={finalized ? "확정을 해제할까요?" : "이 버전을 확정할까요?"}
        description={
          finalized ? (
            <>
              <p>
                <Badge tone="dark" icon="lock">확정됨</Badge> {finalizedBy} · {finalizedAt && formatShort(finalizedAt)}
              </p>
              <p style={{ marginTop: 8 }}>
                {pendingCount > 0
                  ? `확정을 해제하면 반영 대기 중인 입력 ${pendingCount}개로 곧바로 AI 갱신이 시작됩니다.`
                  : "해제하면 이후 승인되는 입력이 다시 spec에 자동으로 반영됩니다."}
              </p>
            </>
          ) : (
            "확정하면 이후 입력이 승인되어도 spec이 자동으로 바뀌지 않고, 반영 대기로 쌓입니다. 관리자가 확정을 해제하면 갱신이 재개됩니다."
          )
        }
        actions={
          <>
            <button type="button" className="btn btn--text" data-autofocus onClick={() => setOpen(false)}>
              취소
            </button>
            <Button variant="primary" disabled={busy} onClick={run}>
              {finalized ? "확정 해제" : "확정"}
            </Button>
          </>
        }
      >
        {error && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{error}</p>}
      </Dialog>
    </>
  );
}
