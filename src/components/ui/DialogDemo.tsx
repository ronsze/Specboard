"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/** 개발 전용 UI 키트의 확인 창 예시 */
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>확인 창 열기</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="v5로 되돌릴까요?"
        description="v5의 내용으로 새 버전 v8이 만들어집니다. v6, v7은 이력에 그대로 남고 언제든 다시 비교할 수 있습니다."
        actions={
          <>
            <button type="button" className="btn btn--text" data-autofocus onClick={() => setOpen(false)}>
              취소
            </button>
            <Button variant="primary" onClick={() => setOpen(false)}>v5로 되돌리기</Button>
          </>
        }
      >
        <ul className="dialog__impact small">
          <li>항목 2개가 빠집니다 (D-3, R-3)</li>
          <li>해소된 질문 1개가 다시 열립니다 (Q-3)</li>
        </ul>
      </Dialog>
    </>
  );
}
