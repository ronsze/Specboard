"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MemberDto } from "@/server/services/members";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

export function MemberManager({ boardId, members }: { boardId: string; members: MemberDto[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body: unknown) {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setError((await res.json()).error ?? "요청에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {members.map((m) => (
        <div key={m.userId} className="card row">
          <span style={{ flex: 1 }}>
            {m.displayName} <span className="meta">{m.email}</span>
          </span>
          <select
            aria-label={`${m.displayName} 역할`}
            value={m.role}
            onChange={(e) => send(`/api/boards/${boardId}/members/${m.userId}`, "PATCH", { role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      ))}
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          send(`/api/boards/${boardId}/members`, "POST", { email: f.get("email"), role: f.get("role") });
          e.currentTarget.reset();
        }}
      >
        <input name="email" type="email" placeholder="추가할 사용자 이메일" required style={{ flex: 1 }} />
        <select name="role" defaultValue="MEMBER">
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button type="submit">추가</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
