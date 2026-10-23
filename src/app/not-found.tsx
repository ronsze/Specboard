import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** 존재하지 않는 주소와 내가 속하지 않은 보드를 구별하지 않는다. */
export default function NotFound() {
  return (
    <main className="container container--narrow">
      <EmptyState
        code="404"
        title="찾을 수 없습니다"
        actions={<ButtonLink href="/" variant="secondary">내 보드로</ButtonLink>}
      >
        주소가 잘못되었거나, 내가 속하지 않은 보드의 화면입니다.
      </EmptyState>
    </main>
  );
}
