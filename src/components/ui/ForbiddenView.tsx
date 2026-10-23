import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { roleLabel } from "@/components/ui/Badge";

/** 권한이 없는 화면. 서버 권한 검사는 서비스에서 별도로 유지된다. */
export function ForbiddenView({
  role,
  what,
}: {
  role: "ADMIN" | "MEMBER" | "VIEWER";
  what: string;
}) {
  return (
    <div className="container container--narrow">
      <EmptyState
        code="403"
        title="이 화면을 볼 권한이 없습니다"
        actions={<ButtonLink href="/" variant="secondary">홈으로</ButtonLink>}
      >
        ‘{what}’는 관리자만 볼 수 있습니다. 지금 내 역할은 {roleLabel(role)}입니다.
      </EmptyState>
    </div>
  );
}
