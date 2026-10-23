import Link from "next/link";
import { RetryButton } from "@/components/spec/RetryButton";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatFull } from "@/lib/format";
import type { SpecView } from "@/server/services/spec";

/** 갱신 중, 실패, 반영 대기, 입력 없음 안내 (FR-024, FR-025). */
export function StatusBanners({
  spec,
  role,
  boardId,
  featureId,
}: {
  spec: SpecView;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  boardId: string;
  featureId: string;
}) {
  const inputsHref = `/boards/${boardId}/features/${featureId}/inputs`;
  const banners: React.ReactNode[] = [];

  if (spec.status === "UPDATING") {
    banners.push(
      <div key="updating" className="stack" style={{ gap: 8 }}>
        <Banner
          tone="info"
          role="status"
          title={spec.version ? `v${spec.version.number + 1}을 만들고 있습니다` : "첫 spec을 만들고 있습니다"}
        >
          승인된 입력 {spec.progress?.inputCount ?? spec.pendingInputCount}개를 읽고 있습니다. 근거가 부족한 내용은 미결 질문으로 남깁니다.
        </Banner>
        <div className="progress" role="progressbar" aria-label="갱신 진행 중" />
      </div>,
    );
  }

  if (spec.status === "FAILED" && spec.failure) {
    banners.push(
      <Banner
        key="failed"
        tone="error"
        role="alert"
        title={`v${spec.failure.nextVersion} 생성에 실패했습니다`}
        actions={role === "ADMIN" ? <RetryButton boardId={boardId} featureId={featureId} /> : undefined}
      >
        {spec.message}
        <div className="mono meta" style={{ marginTop: 4 }}>
          {formatFull(spec.failure.at)} · 시도 {spec.failure.attempts}회
        </div>
      </Banner>,
    );
  }

  if (spec.pendingInputCount > 0 && spec.status !== "UPDATING" && spec.status !== "FAILED") {
    banners.push(
      <Banner
        key="pending"
        tone="wait"
        title={`승인되었으나 아직 반영되지 않은 입력 ${spec.pendingInputCount}개`}
        actions={<Link href={`${inputsHref}?filter=reflect-pending`}>입력 보기</Link>}
      >
        {spec.status === "FINALIZED" ? "확정을 해제하면 반영됩니다" : "다음 AI 갱신에 반영됩니다"}
      </Banner>,
    );
  }

  if (spec.status === "NONE") {
    banners.push(
      <EmptyState
        key="none"
        icon="doc"
        title="아직 승인된 입력이 없습니다"
        actions={
          <ButtonLink href={role === "ADMIN" ? `/boards/${boardId}/pending?feature=${featureId}` : inputsHref} variant="secondary">
            {role === "ADMIN" ? "승인 대기 보기" : "입력 보기"}
          </ButtonLink>
        }
      >
        spec은 승인된 입력만으로 만들어집니다. 입력이 승인되면 AI가 첫 spec을 만듭니다.
      </EmptyState>,
    );
  }

  if (banners.length === 0) return null;
  return <div className="stack">{banners}</div>;
}
