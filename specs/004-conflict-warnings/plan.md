# Implementation Plan: 충돌 경고

**Branch**: `004-conflict-warnings` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-conflict-warnings/spec.md`

## Summary

멤버가 입력을 제출하면 입력당 한 건의 "충돌 검사"를 Postgres 작업 큐에 등록하고, 백그라운드에서 Claude가 그 입력을 spec 최신 버전의 항목과 비교해 어긋날 수 있는 항목을 찾는다. 서버는 결과를 저장하기 직전에 (1) 대상 항목이 저장 시점의 최신 버전에 실제로 존재하는지, (2) 발췌가 입력 원문에 실제로 있는지(003의 `locateQuote`)를 검증하고, 통과한 것만 경고로 저장한다. 경고와 검사 상태는 관리자에게만 내려가며(서버 측), 승인 대기 카드와 feature 입력 화면의 관리자 보기에 같은 컴포넌트로 표시한다. 경고는 참고용이라 승인·반려 경로와 완전히 분리한다.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS 이상 (001~003과 동일)

**Primary Dependencies**: Next.js 15, Prisma, Auth.js, Zod, `@anthropic-ai/sdk` (기존). 신규 의존성 없음

**AI 제공자**: Anthropic API. 모델은 `CONFLICT_MODEL`(없으면 `SPEC_MODEL`, 둘 다 없으면 `claude-opus-5-5`). 구조화 출력, 스트리밍 + `finalMessage()`, `effort: "medium"`, 거절 대비 `fallbacks: "default"`

**Storage**: PostgreSQL 16. `ConflictCheck`(검사 기록이자 작업 큐 행), `ConflictWarning`(경고) 추가

**Testing**: Vitest(통합은 실제 PostgreSQL, AI는 `ConflictDetector` 인터페이스의 가짜 구현), Playwright(E2E, 가짜 AI + axe 접근성). 실제 Claude 평가 스위트(`tests/live`)는 키가 있을 때만 실행하고 SC-009(탐지율·오탐률)를 측정

**Target Platform**: 웹 브라우저, Node 서버 (기존과 동일)

**Project Type**: web-service (기존 단일 Next.js 프로젝트에 모듈 추가)

**Performance Goals**: 제출 후 95%가 1분 이내에 검사 결과 표시(SC-001). 제출·승인 API의 응답 시간은 검사 유무와 무관(검사는 응답 후 `after()`로 시작). 새 조회(관리자용 경고 포함)는 N+1 없이 p95 300ms 이내

**Constraints**: 경고·검사 상태는 관리자에게만 내려간다(응답 객체 생성 단계에서 역할 분기, constitution 원칙 VI). 검사 입력 상한: 입력 본문 50,000자(제출 한도와 동일), 비교 대상 항목 최대 300개·본문 합계 150,000자 — 넘으면 `TOO_LARGE`로 검사 실패 처리. 입력당 경고 최대 5개, 항목당 1개. API 키는 환경 변수로만

**Scale/Scope**: 단일 팀, 입력당 검사 1회(+재시도), 입력 수천 건, 화면 변경 2곳(승인 대기, feature 입력 관리자 보기)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 출처 | 통과 | 경고는 항목의 안정 번호(D-n/R-n)와 입력 원문 발췌로 근거를 가리킨다. 발췌는 원문에 실제로 있는 것만 저장 |
| II. AI 임의 생성 금지 | 통과 | 존재하지 않는 항목을 가리키는 경고는 저장 전 검증에서 폐기. 경고는 판단을 돕는 참고 정보이며 spec 내용을 만들거나 바꾸지 않는다. 프롬프트는 "확실히 모순될 가능성이 높은 경우만" 지시 |
| III. 승인된 입력만 반영 | 통과 | 경고는 승인 경로와 독립. 경고 때문에 승인·반려가 막히거나 상태가 바뀌지 않는다 |
| IV. 버전·이력·롤백 | 통과 | 검사는 새 기록으로 쌓고(다시 검사 시 이전 보존), 경고는 항목 번호와 검사 시점 문구를 스냅샷으로 남긴다. spec 버전에는 영향 없음 |
| V. 충돌은 승인 전에 드러낸다 | **이 feature가 구현** | 승인 대기 화면에서 AI가 충돌 가능성을 경고. 확정된 spec과의 충돌을 더 눈에 띄게 표시 |
| VI. 서버 권한 | 통과 | 확인 처리·다시 검사는 `requireRole(ADMIN)`. 입력 목록·승인 대기 응답에서 비관리자에게는 검사·경고 필드를 아예 만들지 않음 |
| VII. spec-kit 마크다운 | 해당 없음 | 내보내기는 별도 feature |

Phase 1 설계 후 재평가: 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/004-conflict-warnings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml      # 신규·변경 API (001~003 계약에 대한 증분)
└── tasks.md              # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # ConflictCheck, ConflictWarning 추가
└── migrations/<ts>_conflict_warnings/
src/
├── server/
│   ├── ai/
│   │   ├── conflict-detector.ts          # ConflictDetector 인터페이스·타입·오류 코드
│   │   ├── claude-conflict-detector.ts   # Anthropic SDK 구현 (프롬프트, 구조화 출력)
│   │   ├── fake-conflict-detector.ts     # 결정적인 가짜 (테스트·SPEC_WRITER=fake 개발용)
│   │   └── validate-conflicts.ts         # 항목 존재·중복·개수·이유·발췌 검증
│   └── services/
│       ├── conflict-checks.ts            # 등록, 실행(claim·lease·재시도), drain, 다시 검사
│       ├── conflict-view.ts              # 관리자용 ConflictView 직렬화(입력들을 한 번에 조회)
│       └── conflicts.ts                  # 경고 확인(acknowledge), 조회 권한
├── app/api/boards/[boardId]/
│   ├── inputs/[inputId]/conflict-check/retry/route.ts
│   └── conflict-warnings/[warningId]/acknowledge/route.ts
└── components/conflicts/
    ├── ConflictPanel.tsx                 # 카드 안의 검사 상태와 경고 목록
    ├── WarningCard.tsx                   # 경고 한 건 (확정 충돌은 강조)
    └── ConflictActions.tsx               # 확인함, 다시 검사 (client)
tests/
├── unit/          # validate-conflicts
├── integration/   # 검사 큐, 저장 검증, 가시성, 확인 처리, 재시도, 경쟁 상태
├── e2e/           # 승인 화면 경고, 확인, 재검사, 비관리자 비노출
└── live/          # conflict-detector.live.test.ts (SC-009)
```

**Structure Decision**: 002의 작업 큐 패턴을 그대로 따르되, 검사는 입력 단위라 feature 단위 직렬화 대신 "입력당 활성 검사 1개" 부분 유니크 인덱스를 쓴다. AI는 `ConflictDetector` 인터페이스 뒤에 두어 테스트를 결정적으로 만든다. 가시성은 서비스의 응답 생성 단계에서 결정하므로 어떤 화면이 호출해도 비관리자에게 경고가 새지 않는다.

## Complexity Tracking

위반 없음.
