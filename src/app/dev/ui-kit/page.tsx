import { notFound } from "next/navigation";
import {
  Badge,
  InputKindBadge,
  InputStatusBadge,
  ItemKindBadge,
  QuestionStatusBadge,
  RoleBadge,
  SpecStatusBadge,
  VersionKindBadge,
} from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DialogDemo } from "@/components/ui/DialogDemo";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Tabs";

export const metadata = { title: "UI 키트" };

/** 개발·테스트 전용: 모든 공용 컴포넌트와 상태를 한 화면에서 점검한다. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="container container--narrow stack" style={{ gap: 24 }}>
      <h1>UI 키트</h1>

      <Card aria-label="배지">
        <h2>배지</h2>
        <div className="row" style={{ marginTop: 12 }} data-testid="badges">
          <InputStatusBadge status="PENDING" />
          <InputStatusBadge status="APPROVED" />
          <InputStatusBadge status="REJECTED" />
          <InputStatusBadge status="APPROVED" auto />
          <SpecStatusBadge status="NONE" />
          <SpecStatusBadge status="IDLE" />
          <SpecStatusBadge status="UPDATING" />
          <SpecStatusBadge status="FAILED" />
          <SpecStatusBadge status="FINALIZED" />
          <ItemKindBadge kind="DECISION" />
          <ItemKindBadge kind="REQUIREMENT" />
          <QuestionStatusBadge status="OPEN" />
          <QuestionStatusBadge status="RESOLVED" />
          <InputKindBadge kind="MEETING_NOTE" />
          <InputKindBadge kind="IDEA" />
          <InputKindBadge kind="OPINION" />
          <RoleBadge role="ADMIN" />
          <RoleBadge role="MEMBER" />
          <RoleBadge role="VIEWER" />
          <VersionKindBadge kind="AI_UPDATE" />
          <VersionKindBadge kind="REVERT" />
          <Badge tone="src" icon="doc">출처 2</Badge>
        </div>
      </Card>

      <Card aria-label="버튼">
        <h2>버튼</h2>
        <div className="row" style={{ marginTop: 12 }}>
          <Button variant="primary">입력 제출</Button>
          <Button variant="secondary">이 버전 확정</Button>
          <Button variant="danger">반려 확정</Button>
          <Button variant="danger-outline">반려…</Button>
          <Button variant="ok"><Icon name="check" /> 승인</Button>
          <Button variant="text">취소</Button>
          <ButtonLink href="/" variant="secondary">링크 버튼</ButtonLink>
        </div>
        <p className="meta" style={{ marginTop: 12 }}>
          권한 없는 동작은 비활성으로 두지 않고 그리지 않습니다. 대신 상단의 내 역할 배지가 이유를 설명합니다.
        </p>
      </Card>

      <Card aria-label="안내">
        <h2>안내와 빈 상태</h2>
        <div className="stack" style={{ marginTop: 12 }}>
          <Banner tone="wait" title="승인되었으나 아직 반영되지 않은 입력 2개">다음 AI 갱신에 반영됩니다</Banner>
          <Banner tone="error" role="alert" title="v8 생성에 실패했습니다">
            화면에는 마지막으로 성공한 v7이 그대로 보입니다. 입력은 손실되지 않았습니다.
          </Banner>
          <Banner tone="info" title="첫 spec을 만들고 있습니다">승인된 입력 4개를 읽고 있습니다.</Banner>
          <div className="progress" role="progressbar" aria-label="갱신 진행 중" />
          <EmptyState icon="chat" title="아직 입력이 없습니다">
            회의록, 아이디어 한 줄, 의견 무엇이든 괜찮습니다.
          </EmptyState>
        </div>
      </Card>

      <Card aria-label="탭과 확인 창">
        <h2>탭과 확인 창</h2>
        <div className="stack" style={{ marginTop: 12, alignItems: "flex-start" }}>
          <Tabs
            items={[
              { href: "#spec", label: "Spec", active: true },
              { href: "#inputs", label: "입력", count: 14, active: false },
              { href: "#history", label: "버전 이력", active: false },
            ]}
          />
          <DialogDemo />
        </div>
      </Card>

      <Card aria-label="출처와 질문">
        <h2>출처와 미결 질문</h2>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="quote">
            “쿠폰 중복 적용은 <mark>정산 이슈가 커서 주문당 1장으로 제한하기로 함.</mark>”
          </div>
          <div className="q-card">
            <QuestionStatusBadge status="OPEN" />
            <p>쿠폰과 적립금을 한 주문에서 함께 쓸 수 있는가?</p>
          </div>
          <div className="diff-row diff-row--changed">
            <div className="diff-row__mark">~ 변경</div>
            <div className="diff-row__body">
              <p>
                이전 적용 버튼을 <span className="diff-del">비활성화한다.</span>
              </p>
              <p>
                이후 적용 버튼을 <span className="diff-ins">숨기지 않고, 부족한 금액을 안내한다.</span>
              </p>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
