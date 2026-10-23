---

description: "입력 제출과 관리자 승인 구현 태스크"
---

# Tasks: 입력 제출과 관리자 승인

**Input**: Design documents from `/specs/001-input-approval/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: plan.md가 Vitest(실제 PostgreSQL 대상 통합 테스트)와 Playwright를 정했고 quickstart.md에 검증 시나리오가 있으므로 통합 테스트 태스크를 포함한다. 각 스토리의 테스트는 구현 전에 작성해 실패를 확인한다.

**Organization**: 사용자 스토리별로 묶어 독립 구현·검증이 가능하게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 태스크에 의존하지 않음)
- **[Story]**: US1~US4 (spec.md의 사용자 스토리)

## Path Conventions

단일 Next.js 프로젝트: 저장소 루트의 `src/`, `prisma/`, `tests/` (plan.md 구조)

## Phase 1: Setup

- [ ] T001 Next.js 15(App Router, TypeScript, React 19) 프로젝트를 저장소 루트에 초기화하고 plan.md의 디렉터리 구조(`src/app`, `src/server/{auth,authz,services,db}`, `src/lib`, `tests/{unit,integration,e2e}`)를 만든다
- [ ] T002 [P] Prisma, Auth.js, Zod, Vitest, Playwright 의존성을 `package.json`에 추가한다
- [ ] T003 [P] ESLint·Prettier 설정을 `eslint.config.mjs`, `.prettierrc`에 추가한다
- [ ] T004 [P] 로컬 PostgreSQL 16 컨테이너를 `docker-compose.yml`에 정의하고 `.env.example`에 `DATABASE_URL`, `AUTH_SECRET`을 둔다

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 작업을 시작하지 않는다

- [ ] T005 `prisma/schema.prisma`에 data-model.md의 User, Board, Membership(role: ADMIN|MEMBER|VIEWER, 유니크 (boardId, userId)), Project, Feature, Input 모델과 enum(`InputKind`: MEETING_NOTE|IDEA|OPINION, `InputStatus`: PENDING|APPROVED|REJECTED)을 정의한다. Input에는 submitterName 스냅샷, decidedBy, decidedAt, autoApproved, rejectionReason을 포함한다
- [ ] T006 T005 스키마의 초기 마이그레이션을 생성하고 `src/server/db/client.ts`에 Prisma 클라이언트 싱글톤을 만든다
- [ ] T007 [P] `src/server/auth/session.ts`에 Auth.js Credentials(이메일·비밀번호) 설정과 현재 사용자 해석 함수를 구현한다
- [ ] T008 [P] `src/lib/errors.ts`에 `ForbiddenError`, `ValidationError`, `ConflictError`와 HTTP 상태(403/400/409) 매핑을 정의한다
- [ ] T009 `src/server/authz/authorize.ts`에 보드 멤버십을 조회해 역할을 요구하는 단일 진입점 `requireRole(userId, boardId, allowedRoles)`을 구현한다. 비멤버와 역할 부족은 모두 `ForbiddenError` (FR-016, FR-017)
- [ ] T010 [P] `prisma/seed.ts`에 보드 1개, 관리자·멤버·열람자 계정 각 1개, 프로젝트·feature 각 1개 시드를 작성한다
- [ ] T011 [P] `tests/integration/helpers/db.ts`에 테스트용 DB 초기화와 시드 헬퍼를 만든다
- [ ] T012 [P] `tests/unit/authorize.test.ts`에 `requireRole` 단위 테스트(역할별 허용·거부, 비멤버 거부)를 작성한다

**Checkpoint**: 인증, 권한 진입점, 스키마 준비 완료

---

## Phase 3: User Story 1 - 멤버가 입력을 제출한다 (P1) 🎯 MVP

**Goal**: 멤버가 feature에 입력을 제출하면 "대기"로 저장되고 목록에서 보인다

**Independent Test**: 멤버 계정으로 입력 제출 후 대기 상태로 목록에 나타나는지 확인 (quickstart 시나리오 1, 2)

### Tests for User Story 1

- [ ] T013 [P] [US1] `tests/integration/inputs-submit.test.ts`에 시나리오 1(한 줄 아이디어 제출 → PENDING, 제출자·시각 기록), 시나리오 2(빈 내용 거부), 길이 50,000자 초과 거부 테스트를 작성한다

### Implementation for User Story 1

- [ ] T014 [P] [US1] `src/lib/schemas/input.ts`에 Zod 스키마를 정의한다: `kind` enum 3종, `content`는 "공백 제외 1자 이상 50,000자 이하" (FR-003, FR-004)
- [ ] T015 [US1] `src/server/services/inputs.ts`에 `submitInput(user, boardId, featureId, payload)`를 구현한다: MEMBER/ADMIN만 허용, 상태 PENDING, submitterName 스냅샷 저장 (FR-001, FR-002, FR-005, FR-019)
- [ ] T016 [US1] `src/server/services/inputs.ts`에 `listInputs(user, boardId, featureId, status?)`를 구현한다: 모든 멤버 역할 허용, 비멤버 거부
- [ ] T017 [US1] `src/app/api/boards/[boardId]/features/[featureId]/inputs/route.ts`에 GET/POST Route Handler를 계약(openapi.yaml)대로 구현한다
- [ ] T018 [US1] `src/app/boards/[boardId]/features/[featureId]/inputs/page.tsx`에 입력 목록과 제출 폼(종류 선택, 내용, 상태·제출자·시각 표시)을 구현한다
- [ ] T019 [US1] `tests/e2e/submit-input.spec.ts`에 멤버 로그인 → 아이디어 한 줄 제출 → 대기 표시 E2E를 작성한다

**Checkpoint**: 제출과 목록이 독립적으로 동작

---

## Phase 4: User Story 2 - 관리자가 입력을 승인하거나 반려한다 (P1)

**Goal**: 관리자가 대기 입력을 승인하거나 사유와 함께 반려하고, 승인된 입력만 사용 가능 대상이 된다

**Independent Test**: 대기 입력을 관리자가 승인·반려하고 상태와 기록이 맞는지 확인 (quickstart 시나리오 4~9)

### Tests for User Story 2

- [ ] T020 [P] [US2] `tests/integration/inputs-decide.test.ts`에 시나리오 4~7(승인 기록, 사유 없는 반려 거부, 사유 있는 반려, 종결 입력 재처리 409)을 작성한다
- [ ] T021 [P] [US2] `tests/integration/inputs-concurrency.test.ts`에 시나리오 8(두 요청이 동시에 같은 입력을 승인·반려하면 한쪽만 성공, 다른 쪽 409)을 작성한다
- [ ] T022 [P] [US2] `tests/integration/inputs-approved-list.test.ts`에 시나리오 9(`listApprovedInputs`가 APPROVED만 반환, PENDING·REJECTED 0건)를 작성한다

### Implementation for User Story 2

- [ ] T023 [US2] `src/lib/schemas/input.ts`에 반려 스키마를 추가한다: `reason`은 "공백 제외 1자 이상" (FR-008)
- [ ] T024 [US2] `src/server/services/inputs.ts`에 `approveInput`과 `rejectInput`을 구현한다: ADMIN만 허용, `UPDATE ... WHERE status='PENDING'`의 영향 행 수가 0이면 `ConflictError`, decidedBy·decidedAt 기록 (FR-007, FR-008, FR-009)
- [ ] T025 [US2] `src/server/services/inputs.ts`에 `listPendingInputs`(ADMIN만)와 `listApprovedInputs`(APPROVED만 반환하는 단일 질의, 모든 멤버 역할 허용)를 구현한다 (FR-010, FR-018)
- [ ] T026 [US2] `src/app/api/boards/[boardId]/inputs/[inputId]/approve/route.ts`, `reject/route.ts`와 `src/app/api/boards/[boardId]/features/[featureId]/inputs/pending/route.ts`, `approved/route.ts`를 계약대로 구현한다
- [ ] T027 [US2] `src/app/boards/[boardId]/features/[featureId]/inputs/pending/page.tsx`에 관리자용 대기 목록과 승인·반려(사유 입력) UI를 구현한다
- [ ] T028 [US2] 입력 목록 화면(T018 파일)에 반려 상태의 사유·반려자·시각 표시를 추가해 제출자가 확인할 수 있게 한다 (FR-011)
- [ ] T029 [US2] `tests/e2e/approve-reject.spec.ts`에 관리자 승인·반려 E2E를 작성한다

**Checkpoint**: US1 + US2로 제출 → 승인·반려 전체 흐름 완성

---

## Phase 5: User Story 3 - 관리자가 낸 입력은 자동 승인된다 (P2)

**Goal**: 관리자 제출 입력은 대기 없이 승인 상태로 저장된다

**Independent Test**: 관리자 계정으로 제출한 입력이 즉시 APPROVED이고 autoApproved가 true (시나리오 3)

- [ ] T030 [P] [US3] `tests/integration/inputs-auto-approve.test.ts`에 시나리오 3(ADMIN 제출 → APPROVED, autoApproved=true, 승인 기록)을 작성한다
- [ ] T031 [US3] `src/server/services/inputs.ts`의 `submitInput`에서 ADMIN 제출 시 APPROVED·autoApproved=true·decidedBy=제출자·decidedAt=제출 시각으로 저장하도록 분기한다 (FR-006)
- [ ] T032 [US3] 입력 목록 화면(T018 파일)에 "자동 승인" 표시를 추가한다

---

## Phase 6: User Story 4 - 역할별 권한이 적용된다 (P2)

**Goal**: 세 역할의 권한이 서버에서 강제되고 관리자가 멤버 역할을 관리한다

**Independent Test**: 세 역할 계정으로 제출·승인·열람을 시도해 허용·거부를 확인 (시나리오 10~12)

- [ ] T033 [P] [US4] `tests/integration/authz-matrix.test.ts`에 data-model.md의 권한 매트릭스 전 조합(시나리오 10, 11: 열람자 제출 403, 멤버 승인 403, 비멤버 열람 403)을 작성한다
- [ ] T034 [P] [US4] `tests/integration/members.test.ts`에 멤버 추가, 역할 변경, 시나리오 12(유일한 관리자 강등 시 409)를 작성한다
- [ ] T035 [US4] `src/server/services/members.ts`에 `listMembers`, `addMember(email, role)`, `changeRole`을 구현한다: ADMIN만 허용, 이미 멤버면 409, 없는 이메일이면 404, 역할 변경은 트랜잭션 안에서 "보드마다 ADMIN이 1명 이상" 불변식을 재검사해 위반 시 `ConflictError` (FR-012, FR-013, FR-020)
- [ ] T036 [US4] `src/app/api/boards/[boardId]/members/route.ts`와 `members/[userId]/route.ts`를 계약대로 구현한다
- [ ] T037 [US4] `src/app/boards/[boardId]/members/page.tsx`에 멤버 목록, 추가, 역할 변경 UI를 구현한다
- [ ] T038 [US4] 모든 입력 Route Handler가 서비스 계층의 `requireRole`을 통과하는지 점검하고, 누락된 곳을 보완한다 (FR-014, FR-015, FR-016)

---

## Phase 7: Polish & Cross-Cutting

- [ ] T039 [P] `src/lib/errors.ts`의 오류가 화면에서 사용자 친화 메시지(빈 내용, 길이 초과, 이미 처리됨, 권한 없음)로 표시되도록 처리한다
- [ ] T040 [P] `specs/001-input-approval/quickstart.md`의 "실행" 절을 실제 `package.json` 스크립트 명령으로 갱신한다
- [ ] T041 quickstart.md 시나리오 1~12를 처음부터 끝까지 수행해 결과를 확인한다

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → 사용자 스토리 순. Phase 2가 모든 스토리를 막는다.
- **US1**: Phase 2 이후 시작. 다른 스토리에 의존하지 않는다.
- **US2**: US1의 `submitInput`, `listInputs`로 대기 입력을 만들어야 하므로 US1 이후.
- **US3**: US1의 `submitInput` 수정이라 US1 이후. US2와는 독립.
- **US4**: Phase 2 이후 독립 진행 가능. 단 T038은 US1·US2 라우트가 있어야 하므로 마지막에 수행.
- 각 스토리 안에서는 테스트 → 스키마 → 서비스 → Route Handler → 화면 순.

### 병렬 기회

- Phase 1: T002, T003, T004
- Phase 2: T007, T008, T010, T011, T012
- US2 테스트: T020, T021, T022
- US4는 US2와 병렬 진행 가능(서로 다른 파일)

## Implementation Strategy

1. **MVP**: Phase 1 → 2 → US1 → US2. 제출과 승인·반려가 동작해 이 제품의 핵심 통제가 성립한다.
2. US3(자동 승인), US4(권한 관리 UI)를 차례로 추가한다.
3. 각 Checkpoint에서 quickstart.md의 해당 시나리오로 독립 검증한다.
