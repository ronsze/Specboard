"use client";

import { useEffect, useId, useRef } from "react";

/**
 * 네이티브 <dialog> 기반 확인 창. showModal()이 포커스 가둠, 배경 비활성, Esc 닫기를 제공한다.
 * 기본 포커스는 data-autofocus 가 붙은 요소(보통 "취소")에 둔다.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => open && onClose()}
    >
      {open && (
        <>
          <h2 id={titleId} className="dialog__title">{title}</h2>
          {description && <div id={descId} className="dialog__body">{description}</div>}
          {children}
          <div className="dialog__actions">{actions}</div>
        </>
      )}
    </dialog>
  );
}
