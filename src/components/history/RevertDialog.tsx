"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import type { RevertPreview } from "@/server/services/revert-preview";

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "ready"; preview: RevertPreview; notice?: string }
  | { kind: "blocked"; message: string; code: string };

/**
 * 되돌리기 확인 창. 영향 미리보기를 보여주고, 실행할 때 미리보기 수치(expected)를 함께 보내
 * 그 사이 spec이 바뀌었으면 실행하지 않고 최신 영향을 다시 보여준다 (FR-029, FR-030).
 */
export function RevertDialog({ boardId, featureId, version }: { boardId: string; featureId: string; version: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const specBase = `/boards/${boardId}/features/${featureId}/spec`;

  async function open() {
    setError(null);
    setState({ kind: "loading" });
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/revert-preview?toVersion=${version}`);
    const body = await res.json();
    if (res.ok) setState({ kind: "ready", preview: body });
    else if (res.status === 409) setState({ kind: "blocked", message: body.error, code: body.code });
    else {
      setState({ kind: "closed" });
      setError(body.error ?? "미리보기를 불러오지 못했습니다.");
    }
  }

  async function confirm(preview: RevertPreview) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/boards/${boardId}/features/${featureId}/spec/revert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toVersion: version,
        expected: {
          latestVersion: preview.latestVersion,
          removedItems: preview.removedItems,
          reopenedQuestions: preview.reopenedQuestions,
        },
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setState({ kind: "closed" });
      router.push(specBase);
      router.refresh();
      return;
    }
    if (res.status === 409 && body.code === "PREVIEW_CHANGED") {
      setState({ kind: "ready", preview: body.preview, notice: "미리보기 이후 spec이 바뀌었습니다. 아래 영향을 다시 확인해 주세요." });
      return;
    }
    if (res.status === 409) {
      setState({ kind: "blocked", message: body.error, code: body.code });
      return;
    }
    setError(body.error ?? "되돌리기에 실패했습니다.");
  }

  const close = () => setState({ kind: "closed" });
  const dialogOpen = state.kind === "ready" || state.kind === "blocked";

  return (
    <>
      <Button variant="secondary" small onClick={open} disabled={state.kind === "loading"}>
        <Icon name="undo" size={14} /> 이 버전으로 되돌리기
      </Button>
      {error && <span className="error-text small" role="alert"> {error}</span>}
      <Dialog
        open={dialogOpen}
        onClose={close}
        title={state.kind === "blocked" ? (state.code === "FINALIZED" ? "확정된 spec은 되돌릴 수 없습니다" : "되돌릴 변화가 없습니다") : `v${version}로 되돌릴까요?`}
        description={
          state.kind === "ready" ? (
            <>
              <p>
                v{version}의 내용으로 새 버전 <strong>v{state.preview.newVersion}</strong>이 만들어집니다. 이전 버전은 이력에 그대로 남고 언제든 다시 비교할 수 있습니다.
              </p>
              {state.notice && (
                <p className="error-text" role="alert" style={{ marginTop: 8 }}>
                  {state.notice}
                </p>
              )}
            </>
          ) : state.kind === "blocked" ? (
            state.message
          ) : null
        }
        actions={
          state.kind === "blocked" ? (
            <>
              {state.code === "FINALIZED" && (
                <Link href={specBase} className="btn btn--secondary">Spec에서 확정 해제</Link>
              )}
              <button type="button" className="btn btn--text" data-autofocus onClick={close}>닫기</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--text" data-autofocus onClick={close}>취소</button>
              {state.kind === "ready" && (
                <Button variant="primary" disabled={busy} onClick={() => confirm(state.preview)}>
                  v{version}로 되돌리기
                </Button>
              )}
            </>
          )
        }
      >
        {state.kind === "ready" && (
          <ul className="dialog__impact small stack" style={{ gap: 4 }} aria-label="되돌리면 달라지는 점">
            {state.preview.removedItems > 0 && (
              <li>
                <span className="error-text">−</span> 항목 {state.preview.removedItems}개가 빠집니다 ({state.preview.removedLabels.join(", ")})
              </li>
            )}
            {state.preview.reopenedQuestions > 0 && (
              <li>
                <span style={{ color: "var(--q)", fontWeight: 700 }}>?</span> 해소된 질문 {state.preview.reopenedQuestions}개가 다시 열리거나 사라집니다 ({state.preview.reopenedLabels.join(", ")})
              </li>
            )}
            {state.preview.removedItems === 0 && state.preview.reopenedQuestions === 0 && (
              <li>항목과 질문의 수는 그대로이고, 문구와 출처가 v{version}의 상태로 돌아갑니다.</li>
            )}
          </ul>
        )}
        {error && state.kind === "ready" && <p className="error-text" role="alert">{error}</p>}
      </Dialog>
    </>
  );
}
