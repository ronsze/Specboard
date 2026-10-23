# Implementation Plan: AI spec 생성과 버전 이력

**Branch**: `002-ai-spec-versions` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-ai-spec-versions/spec.md`

## Summary

입력이 승인되면 AI(Claude)가 승인된 입력만 재료로 feature별 spec의 새 버전을 자동으로 만든다. 모델의 출력은 구조화된 JSON으로 받고, 서버가 "모든 항목에 출처가 있고, 바뀐 내용은 이번에 반영하는 입력을 근거로 든다"는 규칙을 검증한 뒤에만 새 버전으로 저장한다(원칙 I, II의 강제 지점). 버전은 불변 스냅샷으로 쌓고, 되돌리기·확정·해제는 관리자 전용 서버 검사를 거친다. 갱신은 Postgres 기반 작업 큐(feature당 한 번에 하나)로 처리하고, 001의 승인 경로가 작업을 등록한다.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS 이상 (001과 동일)

**Primary Dependencies**: Next.js 15, Prisma, Auth.js, Zod (001과 동일) + `@anthropic-ai/sdk`

**AI 제공자**: Anthropic API. 기본 모델 `claude-opus-5-5`(환경 변수 `SPEC_MODEL`로 교체 가능), 구조화 출력(`output_config.format`), 스트리밍 + `finalMessage()`, 거절 대비 `fallbacks: "default"`

**Storage**: PostgreSQL 16 (001과 동일). 작업 큐도 같은 DB 사용

**Testing**: Vitest (통합 테스트는 실제 PostgreSQL, AI는 `SpecWriter` 인터페이스의 가짜 구현으로 대체), Playwright (가짜 AI로 E2E). 실제 Claude 호출 테스트는 `ANTHROPIC_API_KEY`가 있을 때만 실행하는 별도 스위트

**Target Platform**: 웹 브라우저, Node 서버 (001과 동일)

**Project Type**: web-service (001의 단일 Next.js 프로젝트에 모듈 추가)

**Performance Goals**: 입력 승인 후 95%가 2분 이내에 새 버전 열람 가능(SC-001). 열람 API는 p95 300ms 이내

**Constraints**: 권한 검사는 서버 측(원칙 VI). 한 번의 갱신에 반영하는 입력은 최대 20개 또는 입력 본문 합계 150,000자 중 먼저 닿는 쪽까지, 나머지는 다음 갱신으로. 모델 응답은 서버 검증을 통과해야만 저장. API 키는 환경 변수로만 주입하고 저장소에 넣지 않음

**Scale/Scope**: 단일 팀, feature당 입력 수백 건, 버전 수십~수백 개, 화면 약 3개(spec 보기, 이력·비교, 관리 동작)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 출처 | 통과 | 모든 항목은 `SpecItemSource`로 입력에 연결. 출처 없는 모델 출력은 서버 검증에서 폐기 |
| II. AI 임의 생성 금지 | 통과 | 프롬프트가 "입력에 없으면 미결 질문"을 지시하고, 서버가 출처 id의 유효성과 변경 근거를 검증 |
| III. 승인된 입력만 | 통과 | 재료 조회는 `status=APPROVED` 단일 질의(001의 `listApprovedInputs`와 같은 조건). 대기·반려는 큐에서 제외 |
| IV. 버전·이력·롤백 | 통과 | 버전은 불변 스냅샷, 되돌리기는 새 버전 생성, 각 버전에 근거 입력 기록 |
| V. 충돌 경고 | 해당 없음 | 별도 feature. 새 입력이 기존 항목을 바꾸는 경우 diff로만 드러남 |
| VI. 서버 권한 | 통과 | 모든 서비스 함수가 `requireRole`을 통과 (열람: 전 역할, 되돌리기·확정·해제·재시도: ADMIN) |
| VII. spec-kit 마크다운 | 해당 없음 | 내보내기는 별도 feature. 데이터 모델은 이후 마크다운 변환이 가능한 구조(항목·질문) |

Phase 1 설계 후 재평가: 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-spec-versions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                      # Spec, SpecVersion, SpecItem, SpecItemSource, OpenQuestion, SpecJob 추가
src/
├── app/
│   ├── api/boards/[boardId]/features/[featureId]/spec/
│   │   ├── route.ts                   # GET 현재 spec
│   │   ├── versions/route.ts          # GET 이력
│   │   ├── versions/[number]/route.ts # GET 버전 상세
│   │   ├── diff/route.ts              # GET 비교
│   │   ├── revert/route.ts            # POST
│   │   ├── finalize/route.ts          # POST
│   │   ├── unfinalize/route.ts        # POST
│   │   └── retry/route.ts             # POST
│   └── boards/[boardId]/features/[featureId]/spec/
│       ├── page.tsx                   # 현재 spec, 출처, 미결 질문, 상태
│       └── history/page.tsx           # 이력과 비교
├── server/
│   ├── ai/
│   │   ├── spec-writer.ts             # SpecWriter 인터페이스, 입력/출력 타입
│   │   ├── claude-spec-writer.ts      # Anthropic SDK 구현 (프롬프트, 구조화 출력)
│   │   └── validate-output.ts         # 출처·변경 근거 검증
│   └── services/
│       ├── spec.ts                    # 조회, 되돌리기, 확정·해제, 비교
│       └── spec-jobs.ts               # 작업 등록, 실행, 재시도, 임대(lease) 회수
└── lib/schemas/spec.ts
tests/
├── unit/                              # validate-output, diff
├── integration/                       # spec 서비스, 작업 큐, 동시성, 권한
└── e2e/
```

**Structure Decision**: 001의 단일 Next.js 프로젝트에 `server/ai`와 spec 서비스를 추가한다. AI 호출은 `SpecWriter` 인터페이스 뒤에 두어 테스트에서 결정적인 가짜로 바꾼다. 별도 큐 인프라는 도입하지 않고 Postgres 작업 테이블로 처리한다.

## Complexity Tracking

위반 없음.
