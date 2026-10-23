"use client";

import { useRouter } from "next/navigation";
import { Fragment, useId, useState } from "react";
import { RoleBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatFull } from "@/lib/format";
import type { MemberDto } from "@/server/services/members";

const ROLES = [
  { value: "ADMIN", label: "관리자" },
  { value: "MEMBER", label: "멤버" },
  { value: "VIEWER", label: "열람자" },
] as const;

/** 멤버 추가와 목록. 역할은 바꾸는 즉시 저장되고, 실패(마지막 관리자 강등 등)는 그 행에 표시된다. */
export function MemberTable({ boardId, members, currentUserId }: { boardId: string; members: MemberDto[]; currentUserId: string }) {
  const router = useRouter();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const addErrorId = useId();

  async function changeRole(m: MemberDto, role: string) {
    setRoles((r) => ({ ...r, [m.userId]: role }));
    setRowErrors((e) => ({ ...e, [m.userId]: "" }));
    const res = await fetch(`/api/boards/${boardId}/members/${m.userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRoles((r) => ({ ...r, [m.userId]: m.role })); // 서버 기준 역할로 되돌린다
      setRowErrors((e) => ({
        ...e,
        [m.userId]: res.status === 409
          ? `${body.error ?? "마지막 관리자는 강등할 수 없습니다."} 다른 멤버를 먼저 관리자로 지정한 뒤 다시 시도하세요. 역할은 ‘관리자’로 유지됩니다.`
          : (body.error ?? "역할을 바꾸지 못했습니다."),
      }));
      return;
    }
    router.refresh();
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setAddError(null);
    const res = await fetch(`/api/boards/${boardId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), role: f.get("role") }),
    });
    if (!res.ok) {
      setAddError((await res.json().catch(() => ({}))).error ?? "멤버를 추가하지 못했습니다.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form onSubmit={add} className="card stack" aria-label="멤버 추가">
        <h2>멤버 추가</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="member-email" className="field__label">이메일</label>
            <input id="member-email" name="email" type="email" className="input" required aria-describedby={addError ? addErrorId : undefined} aria-invalid={addError ? true : undefined} />
          </div>
          <div className="field">
            <label htmlFor="member-role" className="field__label">역할</label>
            <select id="member-role" name="role" className="select" defaultValue="MEMBER">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <Button variant="primary" type="submit">추가</Button>
        </div>
        {addError && <p className="error-text" role="alert" id={addErrorId}><Icon name="warn" size={14} /> {addError}</p>}
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">이메일</th>
              <th scope="col">역할</th>
              <th scope="col">추가일</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const err = rowErrors[m.userId];
              return (
                <Fragment key={m.userId}>
                  <tr data-error={err ? "true" : undefined}>
                    <td>
                      <strong>{m.displayName}</strong>
                      {m.userId === currentUserId && <span className="meta"> (나)</span>}
                    </td>
                    <td className="mono">{m.email}</td>
                    <td>
                      <select
                        className="select"
                        style={{ width: "auto" }}
                        aria-label={`${m.displayName} 역할`}
                        value={roles[m.userId] ?? m.role}
                        aria-invalid={err ? true : undefined}
                        onChange={(e) => changeRole(m, e.target.value)}
                      >
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="mono meta">{formatFull(m.joinedAt).slice(0, 10)}</td>
                  </tr>
                  {err && (
                    <tr data-error="true">
                      <td colSpan={4} role="alert" className="error-text">
                        <Icon name="warn" size={14} /> {err}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="meta">
        역할은 바꾸는 즉시 저장됩니다. <RoleBadge role="ADMIN" /> 승인·반려·확정·되돌리기 · <RoleBadge role="MEMBER" /> 입력 제출 · <RoleBadge role="VIEWER" /> 보기만
      </p>
    </div>
  );
}
