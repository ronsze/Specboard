import Link from "next/link";
import { logout } from "@/app/actions";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { NavLink } from "@/components/layout/NavLink";
import { Logo } from "@/components/ui/Logo";
import { RoleBadge } from "@/components/ui/Badge";
import type { NavTree } from "@/server/services/nav";

type Role = "ADMIN" | "MEMBER" | "VIEWER";

/**
 * 상단 내비. 역할이 허용하지 않는 메뉴는 비활성이 아니라 렌더링하지 않고,
 * 대신 내 역할 배지가 "왜 안 보이는지"를 설명한다 (FR-006, FR-007).
 */
export function AppHeader({
  userName,
  tree,
  board,
}: {
  userName: string;
  tree?: NavTree;
  board?: { id: string; role: Role; pendingCount?: number | null };
}) {
  const pending = board?.pendingCount ?? 0;
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href="/" className="brand">
          <Logo />
          Specboard
        </Link>
        {tree && board && <Breadcrumb tree={tree} />}
        <span className="spacer" />
        {board?.role === "ADMIN" && (
          <>
            <NavLink href={`/boards/${board.id}/pending`}>
              승인 대기
              {pending > 0 && (
                <span className="count-badge" aria-label={`${pending}개`}>
                  {pending > 99 ? "99+" : pending}
                </span>
              )}
            </NavLink>
            <NavLink href={`/boards/${board.id}/members`}>멤버 관리</NavLink>
          </>
        )}
        <span style={{ fontWeight: 600 }}>{userName}</span>
        {board && <RoleBadge role={board.role} />}
        <form action={logout}>
          <button type="submit" className="btn btn--text btn--small">로그아웃</button>
        </form>
      </div>
    </header>
  );
}
