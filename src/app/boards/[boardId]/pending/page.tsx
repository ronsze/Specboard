import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AcknowledgeButton, RecheckButton } from "@/components/conflicts/ConflictActions";
import { ApprovalActions } from "@/components/inputs/ApprovalActions";
import { InputCard } from "@/components/inputs/InputCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ForbiddenView } from "@/components/ui/ForbiddenView";
import { inputLabel } from "@/lib/labels";
import { pageContext } from "@/server/auth/page-context";
import { listBoardPending } from "@/server/services/board-pending";
import { kickConflictChecks } from "@/server/services/conflict-checks";

export const metadata = { title: "승인 대기" };

export default async function BoardPendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ feature?: string }>;
}) {
  const { boardId } = await params;
  const { feature } = await searchParams;
  const { user, role, board } = await pageContext(boardId);
  if (role !== "ADMIN") return <ForbiddenView role={role} what="승인 대기" />;

  const inputs = await listBoardPending(user, boardId, { featureId: feature }).catch(() => []);
  // 멈춘 충돌 검사(프로세스 재시작 등)를 이어서 처리하고, 검사 중이면 자동으로 갱신한다
  await kickConflictChecks(boardId);
  const checking = inputs.some((i) => i.conflict?.state === "CHECKING");
  const withWarnings = inputs.filter((i) => (i.conflict?.warnings.length ?? 0) > 0);
  const unacknowledged = inputs.reduce((n, i) => n + (i.conflict?.unacknowledgedCount ?? 0), 0);

  return (
    <main className="container container--narrow stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Board · {board.name}</div>
          <h1>
            승인 대기 <span className="meta" style={{ fontSize: 28 }}>{inputs.length}</span>
          </h1>
        </div>
        <p className="meta" style={{ maxWidth: 360 }}>
          승인한 입력만 spec 재료가 됩니다. 반려하면 사유가 제출자에게 그대로 보입니다.
        </p>
      </div>
      <AutoRefresh active={checking} />
      {withWarnings.length > 0 && (
        <p className="banner banner--wait small" role="status">
          충돌 가능성이 있는 입력 {withWarnings.length}개 · 아직 확인하지 않은 경고 {unacknowledged}개
        </p>
      )}
      {feature && (
        <p className="small">
          한 feature의 입력만 보고 있습니다. <Link href={`/boards/${boardId}/pending`}>보드 전체 보기</Link>
        </p>
      )}
      {inputs.length === 0 ? (
        <EmptyState icon="check" title="승인을 기다리는 입력이 없습니다" actions={<ButtonLink href="/" variant="secondary">홈으로</ButtonLink>}>
          새 입력이 제출되면 여기에 모입니다.
        </EmptyState>
      ) : (
        inputs.map((input) => (
          <InputCard
            key={input.id}
            input={input}
            headerRight={
              <Link href={`/boards/${boardId}/features/${input.featureId}/inputs#${inputLabel(input.number)}`}>
                {input.projectName} / {input.featureName}
              </Link>
            }
            conflict={input.conflict}
            conflictSlots={{
              renderWarningActions: (id) => <AcknowledgeButton boardId={boardId} warningId={id} />,
              actions: input.conflict?.recheckable ? <RecheckButton boardId={boardId} inputId={input.id} /> : undefined,
            }}
            actions={<ApprovalActions boardId={boardId} inputId={input.id} />}
          />
        ))
      )}
    </main>
  );
}
