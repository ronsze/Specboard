---

description: "디자인 시안 적용 구현 태스크"
---

# Tasks: 디자인 시안 적용

**Input**: Design documents from `/specs/003-design-system-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md, design-parity.md. 001·002 구현이 끝난 저장소를 전제한다.

**Tests**: plan.md가 Vitest(실제 PostgreSQL)와 Playwright(키보드, axe 라이트·다크)를 정했고 quickstart.md에 25개 시나리오가 있으므로 테스트 태스크를 포함한다. 서비스·단위 테스트는 구현 전에 작성해 실패를 확인한다. **기존 E2E(`tests/e2e/*.spec.ts`)는 화면이 바뀌므로 해당 스토리에서 함께 갱신한다.**

**Organization**: 사용자 스토리별로 묶어 독립 구현·검증이 가능하게 한다. 화면 기준은 `docs/Specboard-selection.pdf`와 `design-parity.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 태스크에 의존하지 않음)
- **[Story]**: US1~US8 (spec.md의 사용자 스토리)

## Path Conventions

001·002와 같은 단일 Next.js 프로젝트: 저장소 루트의 `src/`, `prisma/`, `tests/`

## Phase 1: Setup

- [ ] T001 `@axe-core/playwright`를 devDependency로 추가한다(테스트 전용, 런타임 UI 라이브러리는 추가하지 않는다)

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 작업을 시작하지 않는다

### 번호와 스키마

- [ ] T002 `prisma/schema.prisma`를 변경한다: `Board.inputSeq Int @default(0)`, `Input.boardId String`과 `Input.number Int`(유니크 `(boardId, number)`, 인덱스 `(boardId, status, submittedAt)`), `Spec.decisionSeq Int @default(0)`, `Spec.requirementSeq Int @default(0)`, `Spec.questionSeq Int @default(0)`, `SpecItem.number Int`(유니크 `(versionId, kind, number)`), `OpenQuestion.number Int`(유니크 `(versionId, number)`), `SpecItemSource.quoteStart Int?`·`quoteEnd Int?`, `OpenQuestionSource.quoteStart Int?`·`quoteEnd Int?`
- [ ] T003 마이그레이션을 `--create-only`로 생성하고 SQL을 직접 편집한다: 새 컬럼을 nullable로 추가 → `Input.boardId`를 feature→project→board에서 채움 → 보드별 `row_number() OVER (PARTITION BY boardId ORDER BY submittedAt, id)`로 `Input.number` 부여 후 `Board.inputSeq`를 최댓값으로 설정 → spec별로 `(key, kind)` 쌍의 최초 등장(최소 버전 번호, 그 안의 position) 순서로 종류별 `SpecItem.number`를 부여해 같은 `(key, kind)`의 모든 버전 행에 복사하고(002에는 종류 변경 금지 규칙이 없어 종류가 바뀐 key는 종류별로 번호를 받는다) `Spec.decisionSeq`·`requirementSeq`를 최댓값으로 설정, 질문은 key의 최초 등장 순서로 `OpenQuestion.number`를 부여하고 `Spec.questionSeq`를 최댓값으로 설정 → NOT NULL과 유니크 제약 적용. 기존 입력·항목·출처·버전의 내용은 변경하지 않는다 (FR-013)
- [ ] T004 [P] `scripts/verify-numbering.ts`에 개발 DB 점검 스크립트를 작성한다: 보드별 입력 번호 중복·누락 0, 버전 전체에서 같은 key의 번호 일치, 종류별 항목 번호와 질문 번호 중복 0, `Board.inputSeq`·`Spec.*Seq`가 최댓값과 일치함, **종류가 바뀐 key의 수**를 출력(시나리오 1). `package.json`에 `db:verify-numbering` 스크립트를 추가한다
- [ ] T005 마이그레이션을 개발 DB에 적용하고 `npm run db:verify-numbering`으로 backfill을 확인한다(001·002로 쌓인 데이터 사용). 테스트 DB는 `tests/global-setup.ts`의 `migrate deploy`로 갱신된다
- [ ] T006 [P] `src/lib/labels.ts`에 `inputLabel(n)`(`IN-n`), `itemLabel(kind, n)`(결정 `D-n`, 요구사항 `R-n`), `questionLabel(number)`(`Q-n`)를 만들고 `tests/unit/labels.test.ts`로 검증한다
- [ ] T007 [P] `tests/integration/numbering.test.ts`에 실패 테스트를 작성한다: 같은 보드에서 입력 20개를 동시에 제출해도 `(boardId, number)`가 1..20으로 중복·결번 없음, 제출이 검증 실패로 롤백되면 번호가 소비되지 않음, 보드가 다르면 번호가 각각 1부터 시작함 (FR-010)
- [ ] T008 `src/server/services/numbering.ts`에 `allocateInputNumber(tx, boardId)`(`UPDATE "Board" SET "inputSeq" = "inputSeq" + 1 ... RETURNING`)를 구현하고, `src/server/services/inputs.ts`의 `submitInput`이 입력 생성과 같은 트랜잭션에서 `boardId`·`number`를 설정하도록 바꿔 T007을 통과시킨다
- [ ] T009 [P] `tests/unit/validate-output.test.ts`에 "기존 key의 `kind` 변경 거부" 케이스를 추가하고 `src/server/ai/validate-output.ts`가 이를 거부하도록 한다 (FR-011)
- [ ] T010 `src/server/services/numbering.ts`에 `allocateItemNumber(tx, specId, kind)`와 `allocateQuestionNumber(tx, specId)`를 추가하고, `src/server/services/spec-jobs.ts`의 버전 저장(새 key에만 번호 부여, 기존 key는 이전 버전의 번호를 복사)과 `src/server/services/spec.ts`의 `revertSpec`(번호 그대로 복사)이 `SpecItem.number`와 `OpenQuestion.number`를 채우도록 수정한다. 기존 002 통합 테스트가 모두 통과해야 한다
- [ ] T011 [P] `tests/integration/spec-numbering.test.ts`에 항목·질문 번호 테스트를 작성한다: 질문도 1부터 증가하고 해소되어도 번호 유지, 결정·요구사항이 종류별로 1부터 증가, 문구가 바뀌어도 번호 유지, 새 버전에서 같은 key는 같은 번호, 되돌리기 후에도 번호 유지, 삭제된 항목의 번호는 재사용되지 않음 (FR-011)

### 공용 계산

- [ ] T012 [P] `tests/unit/spec-status.test.ts`에 `deriveSpecStatus` 테스트를 작성한다: 확정 > 갱신 중 > 실패(반영 대기 입력이 있을 때만) > 입력 없음(`NONE`) > `IDLE` 우선순위
- [ ] T013 `src/server/services/spec-status.ts`에 `deriveSpecStatus`를 구현하고 `src/server/services/spec.ts`의 `getSpec`이 이를 사용하도록 리팩터링해 T012와 기존 `spec-status.test.ts`를 통과시킨다
- [ ] T014 [P] `tests/unit/spec-provenance.test.ts`에 변경 버전 계산 테스트를 작성한다: 처음 등장 버전, 문구가 달라진 가장 최근 버전, 바뀌지 않으면 처음 버전, 항목이 사라졌다가 되돌리기로 복원되면 그 되돌림 버전이 마지막 변경, 최신 버전 기준 `ADDED`·`CHANGED`·`NONE` 판정, 질문이 처음 RESOLVED가 된 버전(`resolvedInVersion`, 열린 질문은 null, 되돌리기로 다시 열리면 null)
- [ ] T015 `src/server/services/spec-provenance.ts`에 `computeProvenance(rows)`를 구현한다(spec의 전 버전 항목을 `(key, text, versionNumber)`로 한 번에 읽어 key별 `firstVersion`·`lastChangedVersion` 계산, 질문은 `(key, status, versionNumber)`로 `resolvedInVersion` 계산)해 T014를 통과시킨다
- [ ] T016 [P] `src/lib/errors.ts`의 `AppError`가 응답 본문에 `code`와 부가 데이터를 실을 수 있도록 확장하고 `toErrorResponse`가 이를 직렬화한다(`PREVIEW_CHANGED` 등에 사용). 기존 오류 응답 형식은 유지한다

**Checkpoint**: 번호, 상태 판정, 변경 버전 계산, 오류 확장 준비 완료. 001·002 테스트 전부 통과

---

## Phase 3: User Story 8 - 일관된 토큰과 접근성, 라이트·다크 (P1) 🎯 기반

**Goal**: 모든 화면이 쓸 토큰과 공용 컴포넌트, 헤더(내 역할 배지)를 갖추고 접근성 점검 도구를 마련한다

**Independent Test**: 공용 컴포넌트 모음과 기존 화면 하나에 대해 라이트·다크 axe 점검과 키보드 점검이 통과한다 (시나리오 22 일부)

### Tests for User Story 8

- [ ] T017 [P] [US8] `tests/e2e/helpers/a11y.ts`에 `expectNoA11yViolations(page)`(axe, color-contrast 포함)와 `forEachColorScheme(page, fn)`(`page.emulateMedia({ colorScheme })`로 라이트·다크 순회)을 만든다
- [ ] T018 [P] [US8] `tests/e2e/ui-kit.spec.ts`에 컴포넌트 모음 페이지(`/dev/ui-kit`, 개발·테스트 전용)에 대해 라이트·다크 axe 위반 0건, 모든 배지가 아이콘/기호와 글자를 함께 가짐, `<dialog>`가 Esc로 닫히고 열린 동안 포커스가 밖으로 나가지 않으며 기본 포커스가 취소 버튼에 있음을 검증한다 (SC-001~SC-003)

### Implementation for User Story 8

- [ ] T019 [P] [US8] `src/styles/tokens.css`에 research.md의 토큰을 CSS 변수로 정의한다: 라이트(`--bg, --surface, --ink, --ink-3, --src, --q, --ai, --line, --ok, --wait, --no, --auto`)와 `@media (prefers-color-scheme: dark)`의 같은 이름 덮어쓰기, 간격 `--s-1..--s-7`(4·8·12·16·24·32·48), 모서리(배지 6·버튼 8·카드 12·출처 칩 full), 타이포 스케일(display 28/1.3·700, h2 18/1.4·600, item 16/1.65, body 15/1.7, small 13/1.6, meta mono 12)
- [ ] T020 [P] [US8] `src/styles/base.css`에 리셋, 본문 타이포(`word-break: keep-all`), 보이는 포커스 링(라이트·다크 모두 대비 3:1 이상), 링크·버튼 기본, `prefers-reduced-motion` 처리를 작성한다
- [ ] T021 [US8] `src/app/layout.tsx`에서 `next/font/google`로 IBM Plex Sans KR(본문)과 IBM Plex Mono(번호·시각·ID)를 `display: swap`과 시스템 글꼴 대체 스택으로 설정하고 `tokens.css`·`base.css`·`components.css`를 불러온다. 기존 `globals.css`는 새 스타일로 대체한다(단계적으로 제거)
- [ ] T022 [P] [US8] `src/components/ui/Icon.tsx`에 인라인 SVG 아이콘 약 15개(시계, 체크, 엑스, 경고, 자물쇠, 문서, 물음표, 비교, 되돌리기, 펼침 화살표, 사람, 눈, 닫기, 화살표, 새로고침)를 만든다. 장식용은 `aria-hidden`, 의미를 가진 것은 글자를 함께 둔다
- [ ] T023 [P] [US8] `src/components/ui/Badge.tsx`에 변형(입력 상태, spec 반영, spec 상태, 항목 종류, 입력 종류, 역할, 버전 방식)을 만든다. 모든 변형은 아이콘 또는 기호와 글자를 가진다
- [ ] T024 [P] [US8] `src/components/ui/Button.tsx`(주, 보조, 위험, 텍스트), `Card.tsx`, `EmptyState.tsx`, `Tabs.tsx`(링크 기반, `aria-current`), `Banner.tsx`(정보·경고·오류)를 만든다
- [ ] T025 [US8] `src/components/ui/Dialog.tsx`에 네이티브 `<dialog>` + `showModal()` 기반 확인 창을 만든다: 취소 버튼 `autofocus`, Esc 닫기, 닫힐 때 호출한 요소로 포커스 복귀, 제목·설명 `aria-labelledby/aria-describedby`
- [ ] T026 [US8] `src/styles/components.css`에 위 컴포넌트와 시안의 카드·입력 필드·버튼·비교 행·출처 패널·질문 카드의 클래스를 작성한다(색은 토큰만 사용, 상태 색은 의미 용도로만)
- [ ] T027 [P] [US8] `src/app/dev/ui-kit/page.tsx`에 모든 컴포넌트와 상태를 한 화면에 모은 개발 전용 페이지를 만든다(`NODE_ENV === "production"`이면 404)
- [ ] T028 [US8] `src/components/layout/AppHeader.tsx`에 상단 내비를 만든다: 로고, 브레드크럼 자리, (관리자만) "승인 대기 N" 배지와 "멤버 관리", 사용자 이름, 내 역할 배지, 로그아웃. 권한이 없는 항목은 렌더링하지 않는다 (FR-006, FR-007)
- [ ] T029 [US8] `src/components/layout/Breadcrumb.tsx`에 보드 › 프로젝트 › feature 경로와 각 단계의 전환 메뉴(`<details>`, 키보드 조작 가능)를 만든다
- [ ] T030 [US8] `src/app/boards/[boardId]/layout.tsx`와 `src/app/boards/[boardId]/features/[featureId]/layout.tsx`에서 헤더 데이터(내 역할, 관리자일 때 대기 수)와 feature 탭(Spec / 입력 N / 버전 이력, 기존 URL 유지)을 제공한다. 탭의 "입력 N" 개수는 T047, 헤더의 승인 대기 수는 T058에서 실제 값으로 연결하며, 그 전에는 숫자를 숨긴다
- [ ] T031 [P] [US8] `src/app/not-found.tsx`와 `src/components/ui/ForbiddenView.tsx`에 시안의 404, 403 화면(현재 내 역할 표시, "홈으로"/"내 보드로")을 만든다. 404는 접근 권한이 없는 보드의 존재 여부를 드러내지 않는다 (FR-036)

**Checkpoint**: 토큰, 공용 컴포넌트, 헤더, 접근성 점검 도구가 갖춰짐

---

## Phase 4: User Story 1 - spec 화면 (P1) 🎯 MVP

**Goal**: spec 화면이 시안 1쪽대로 항목(번호·변경 표시), 출처 패널, 미결 질문 레일, 상태 안내, 최근 버전을 보여준다

**Independent Test**: 항목·질문·확정·실패 상태가 있는 spec을 열어 시안 1쪽, 10쪽의 구조와 대조한다 (시나리오 3~5, 17)

### Tests for User Story 1

- [ ] T032 [P] [US1] `tests/integration/spec-view.test.ts`에 `getSpec` 확장 테스트를 작성한다: 항목의 `number`·`label`(D-1, R-1), `firstVersion`·`lastChangedVersion`·`change`, 출처의 `number`(IN-n)와 `status`, 질문의 `number`·`label`(Q-n)·`resolvedInVersion`, `counts`(결정·요구사항·열린·해소 질문), `recentVersions`(최대 3개, `isCurrent`), 갱신 중일 때 `progress.inputCount`, 실패일 때 `failure`(시도 횟수, 시각, 코드, 생성하려던 버전 번호), 확정 메시지에 해제 시 반영될 대기 입력 수 (FR-012, FR-022~FR-025)
- [ ] T033 [P] [US1] `tests/e2e/spec-screen.spec.ts`를 작성한다: 항목 번호와 "vN부터" 표시, "출처 N" 클릭 → 출처 패널(입력 번호·종류·제출자·시각·승인) → "원문 전체 보기"까지 클릭 두 번 이내, 미결 질문 레일의 열림·해소 구분, 확정·갱신 중 상태 안내, 멤버에게는 확정·재시도 버튼이 보이지 않음 (시나리오 3~5, 17, 21)

### Implementation for User Story 1

- [ ] T034 [US1] `src/server/services/spec-view.ts`를 확장한다: `ItemView`에 `number`·`label`·`firstVersion`·`lastChangedVersion`·`change`, `SourceRef`에 `number`·`status`·`quote`(null), `QuestionView`에 `number`·`label`(`Q-n`, 안정 번호)·`resolvedInVersion`, 버전 `counts`와 `isCurrent`. 기존 필드는 제거하지 않는다
- [ ] T035 [US1] `src/server/services/spec.ts`의 `getSpec`을 확장한다: `computeProvenance`로 변경 버전 계산, `counts`, `recentVersions`(최근 3개), `progress`(반영 대기 입력 수, 배치 상한 적용), `failure`(최신 FAILED 작업의 시도 횟수·시각·코드·다음 버전 번호), 상태별 안내 문구(시안 10쪽: 갱신 중, 실패 — "마지막 성공 버전이 그대로 보이고 입력은 손실되지 않았음", 확정, 입력 없음 — 대기 입력 수 포함)를 반환해 T032를 통과시킨다
- [ ] T036 [P] [US1] `src/components/spec/SpecHeaderCard.tsx`에 버전 카드(최신 배지, 버전·시각·생성 방식, "이력·비교" 링크, 관리자에게만 "이 버전 확정")를 만든다
- [ ] T037 [P] [US1] `src/components/spec/StatusBanner.tsx`에 상태 안내(갱신 중 진행 막대와 "입력 N개를 읽고 있습니다", 실패 — 관리자는 "AI 갱신 다시 시도"·멤버/열람자는 안내만, 확정, 승인된 입력 없음 — "승인 대기 보기" 링크, 질문만 있고 항목이 없음 — "미결 질문 보기")과 반영 대기 입력 배너("다음 AI 갱신에 반영됩니다", "입력 보기" 링크)를 만든다 (FR-024, FR-025)
- [ ] T038 [P] [US1] `src/components/spec/ItemCard.tsx`와 `SourcePanel.tsx`에 항목 카드(종류 배지, 번호, 문구, "AI 정리 · vN부터/vN에서 변경/vN에서 추가", "출처 N" 칩)와 출처 패널(`[n] IN-번호`, 종류, 제출자, 시각, 승인, 본문, "원문 전체 보기" 링크, 발췌 강조 자리)을 만든다. 펼침은 `aria-expanded`로 키보드 조작 가능
- [ ] T039 [P] [US1] `src/components/spec/QuestionRail.tsx`에 미결 질문 레일(열림·해소 개수, 안내문, 질문 카드 Q-n, "해소됨" 구분선, 답이 된 입력 칩, 관련 입력 없음 문구, 멤버·관리자에게만 "질문에 답하는 입력 제출" 진입점 — 입력 화면의 제출 폼으로 이동하는 링크)을 만든다 (FR-026)
- [ ] T040 [P] [US1] `src/components/spec/RecentVersions.tsx`와 `LockControl.tsx`에 최근 버전 카드와 확정 컨트롤(확정됨 배지·확정자·시각, 확정 확인 창, 확정 해제 확인 창 — 해제하면 곧바로 반영될 대기 입력 수 안내)을 만든다. 기존 `FinalizeButton`을 대체한다
- [ ] T041 [US1] `src/app/boards/[boardId]/features/[featureId]/spec/page.tsx`를 시안 1쪽 구조(항목 영역 + 우측 질문 레일 + 최근 버전)로 다시 만들고, 갱신 중이면 자동 새로고침을 유지한다. 구 컴포넌트(`SpecItemList`, `OpenQuestionList`, `SourceList`, `FinalizeButton`, `RetryButton`)는 대체 후 제거한다
- [ ] T042 [US1] `src/styles/components.css`에 spec 화면 반응형(`max-width: 720px`: 단일 컬럼, 질문 레일을 항목 위로)을 추가한다 (FR-009)
- [ ] T043 [US1] 기존 `tests/e2e/spec-flow.spec.ts`를 새 화면에 맞게 갱신한다

**Checkpoint**: spec 화면이 시안과 일치하고 독립적으로 동작

---

## Phase 5: User Story 2 - 입력 화면 (P1)

**Goal**: 입력 화면이 번호·상태·원문·필터·펼치기·제출 폼을 시안 5쪽대로 보여준다

**Independent Test**: 상태가 다른 입력과 긴 회의록이 있는 feature에서 필터, 펼치기, 제출 폼을 확인한다 (시나리오 10~12)

### Tests for User Story 2

- [ ] T044 [P] [US2] `tests/integration/input-view.test.ts`에 `listInputsView` 테스트를 작성한다: 필터 4종(`all`, `mine-pending`, `reflect-pending`, `rejected`)이 가시성 규칙(관리자 전체, 그 외 승인·반려 + 본인 대기) 안에서 동작, `counts`가 각 필터 결과 수와 일치, `limit`/`cursor` 페이징과 `nextCursor`, 잘못된 filter·limit는 400, 입력에 `number`·`reflectedVersion`·`isMine` 포함, 비멤버 403 (FR-014, FR-016)
- [ ] T045 [P] [US2] `tests/e2e/inputs-screen.spec.ts`를 작성한다: 필터 칩 선택이 주소(`?filter=`)에 반영되고 새로고침 후 유지, 긴 본문 "펼치기"와 전체 글자 수, 멤버 본인 대기 입력의 "나와 관리자에게만 보임", 반려 사유 박스, 제출 폼의 글자 수 카운터와 흐름 안내, 50,000자에 가까운 원문에서도 레이아웃이 깨지지 않고 접힘·펼침이 동작, 열람자에게는 폼 없음 (시나리오 10~12, 21)

### Implementation for User Story 2

- [ ] T046 [US2] `src/server/services/inputs.ts`의 `InputDto`·`toDto`에 `number`, `reflectedVersion`(반영한 버전 번호, 없으면 null), `isMine`을 추가한다. 반영 버전 번호는 `consumedVersionId`로 조회하되 N+1 없이 한 번에 읽는다
- [ ] T047 [US2] `src/server/services/inputs.ts`에 `listInputsView(user, boardId, featureId, { filter, limit, cursor })`를 구현해 T044를 통과시킨다. 기존 `listInputs`는 유지한다
- [ ] T048 [US2] `src/app/api/boards/[boardId]/features/[featureId]/inputs/view/route.ts`에 GET을 계약대로 구현한다
- [ ] T049 [P] [US2] `src/components/inputs/InputCard.tsx`에 입력 카드(종류·상태 배지, IN-번호, 제출자·시각, 원문 그대로, 승인자·시각 또는 "자동 승인 · 관리자 제출", "vN에 반영됨/반영 대기", 반려 사유 박스와 "spec에 쓰이지 않음", "나와 관리자에게만 보임", 긴 본문 접힘과 "펼치기 · 전체 N자")을 만든다 (FR-014, FR-015)
- [ ] T050 [P] [US2] `src/components/inputs/InputFilters.tsx`(링크 기반 필터 칩과 개수)와 "이전 입력 N개 더 보기"(`cursor` 링크)를 만든다 (FR-016)
- [ ] T051 [P] [US2] `src/components/inputs/SubmitInputForm.tsx`를 시안대로 다시 만든다: 종류 세그먼트(라디오 그룹), 본문과 `0 / 50,000` 카운터, "제출 후 흐름" 안내, 제출 오류 표시, 제출 후 목록 갱신 (FR-017)
- [ ] T052 [US2] `src/app/boards/[boardId]/features/[featureId]/inputs/page.tsx`를 시안 5쪽의 2열 구조(제출 폼 + 필터·목록)로 다시 만들고, 열람자에게는 폼을 렌더링하지 않는다. 휴대폰 너비에서는 단일 컬럼으로 폼이 목록 위에 온다 (FR-009)
- [ ] T053 [US2] 기존 `tests/e2e/submit-input.spec.ts`, `approve-reject.spec.ts`를 새 화면(승인 대기 흐름은 T060·T061 이후)에 맞게 갱신한다

**Checkpoint**: US1 + US2로 핵심 두 화면이 시안과 일치

---

## Phase 6: User Story 3 - 보드 단위 승인 대기 (P2)

**Goal**: 관리자가 보드 전체의 대기 입력을 한 화면에서 처리하고 상단 배지로 개수를 본다

**Independent Test**: 두 feature에 대기 입력이 있는 보드에서 한 화면으로 승인·반려한다 (시나리오 13~15)

### Tests for User Story 3

- [ ] T054 [P] [US3] `tests/integration/board-pending.test.ts`에 테스트를 작성한다: 두 feature의 대기 입력이 한 목록에 오래된 순으로 나오고 프로젝트·feature 이름 포함, `feature` 필터, 승인·반려 후 목록과 개수 감소, 개수 0, 관리자 외(멤버·열람자·비멤버)는 403, 다른 보드의 입력은 섞이지 않음, 이미 처리된 입력 처리 시 409 (FR-018~FR-020)
- [ ] T055 [P] [US3] `tests/e2e/board-pending.spec.ts`를 작성한다: 서로 다른 feature의 입력 승인·반려를 한 화면에서 처리, 반려 사유 비면 확정 불가·취소 가능, 상단 배지 숫자 갱신과 0일 때 숫자 숨김, 100개 이상일 때 "99+" 표시, 멤버에게는 메뉴·배지 없음 (시나리오 13, 14, 21)

### Implementation for User Story 3

- [ ] T056 [US3] `src/server/services/board-pending.ts`에 `listBoardPending(user, boardId, { featureId })`와 `countBoardPending(user, boardId)`를 구현한다: ADMIN만, `Input.boardId` 인덱스로 한 쿼리, 프로젝트·feature 이름 join, 제출 시각 오름차순 — T054를 통과시킨다
- [ ] T057 [US3] `src/app/api/boards/[boardId]/pending/route.ts`와 `pending/count/route.ts`를 계약대로 구현한다
- [ ] T058 [US3] T030의 헤더에 실제 대기 수를 연결한다(관리자만, 0이면 숫자 숨김, 100 이상이면 "99+")
- [ ] T059 [P] [US3] `src/components/inputs/RejectForm.tsx`에 반려 사유 폼(필수, "제출자에게 그대로 보임" 안내, 취소, 반려 확정, 빈 사유 거부)과 `ApprovalActions.tsx`(승인, 반려…, 이미 처리됨 안내와 목록 갱신)를 만든다 (FR-020)
- [ ] T060 [US3] `src/app/boards/[boardId]/pending/page.tsx`에 시안 6쪽의 보드 단위 승인 대기 화면을 만든다(feature 링크, 긴 본문 펼치기, `?feature=` 필터). 멤버·열람자는 `ForbiddenView`
- [ ] T061 [US3] `src/app/boards/[boardId]/features/[featureId]/inputs/pending/page.tsx`를 `/boards/[boardId]/pending?feature=[featureId]` 리다이렉트로 바꾸고 기존 `DecisionButtons`를 제거한다

---

## Phase 7: User Story 4 - 홈 요약 (P2)

**Goal**: 홈에서 보드·프로젝트·feature의 spec 상태와 요약을 본다

**Independent Test**: 상태가 다른 feature 5개가 있는 보드에서 각 요약이 상태와 일치한다 (시나리오 16)

### Tests for User Story 4

- [ ] T062 [P] [US4] `tests/integration/home.test.ts`에 테스트를 작성한다: feature별 `specStatus`(`NONE`, `IDLE`, `UPDATING`, `FAILED`, `FINALIZED`), 최신 버전 번호·날짜, `pendingReflectCount`, 갱신 중일 때 `updatingToVersion`, 관리자 보드에만 `pendingApprovalCount`, 보드마다 다른 역할, 속하지 않은 보드는 나오지 않음, `getSpec`의 상태와 항상 일치, 쿼리 수가 feature 수에 비례하지 않음(Prisma 쿼리 이벤트 카운트로 확인) (FR-021)
- [ ] T063 [P] [US4] `tests/e2e/home.spec.ts`를 작성한다: 보드 카드의 내 역할 배지, feature 상태 배지, "승인된 입력 없음", 관리자 보드에만 "승인 대기 N"과 멤버 관리 진입점 (시나리오 16)

### Implementation for User Story 4

- [ ] T064 [US4] `src/server/services/home.ts`에 `getHome(user)`를 구현한다: 보드·프로젝트·feature를 가져오고 spec, 최신 버전, 활성·실패 작업, 반영 대기 수를 `groupBy`/`IN` 쿼리로 한 번씩만 조회해 조합하며 `deriveSpecStatus`를 재사용한다 — T062를 통과시킨다
- [ ] T065 [US4] `src/app/api/home/route.ts`에 GET을 계약대로 구현한다
- [ ] T066 [US4] `src/app/page.tsx`를 시안 8쪽(보드 카드, 프로젝트 구분 행, feature 행: 이름·상태 배지·버전·날짜·반영 대기 수, 갱신 중 "vN → vN+1")으로 다시 만든다

---

## Phase 8: User Story 5 - 버전 이력, 비교, 되돌리기 (P2)

**Goal**: A/B 비교, 변경 없는 항목 숨김, 단어 단위 강조, 되돌리기 영향 미리보기

**Independent Test**: 버전 3개 이상에서 A/B 비교하고 되돌리기 확인 창의 수치가 실제 결과와 일치한다 (시나리오 18~20)

### Tests for User Story 5

- [ ] T067 [P] [US5] `tests/unit/word-diff.test.ts`에 단어 단위 diff 테스트를 작성한다: 어절 기준 추가·삭제 구간, 한글 문장, 변화 없음, 전부 다름, 빈 문자열 (FR-028)
- [ ] T068 [P] [US5] `tests/integration/spec-diff-v2.test.ts`에 비교 확장 테스트를 작성한다: `summary`(추가·삭제·변경·동일 개수), 변경에 `label`·`kind`·`scope`, `addedSources`(to에만 있는 출처의 입력 번호), 같은 버전 비교는 400, 번호가 다르지만 내용이 같은 두 버전은 변경 0건과 `unchanged` 개수만 반환("차이가 없습니다" 표시용), 질문 변경(열림→해소) (FR-027, FR-028)
- [ ] T069 [P] [US5] `tests/integration/revert-preview.test.ts`에 테스트를 작성한다: `removedItems`·`reopenedQuestions` 수와 라벨이 실제로 되돌린 결과와 일치(여러 조합으로 `revertSpec` 후 비교), 확정 상태 409(`FINALIZED`), 최신과 같은 내용 409(`NO_CHANGE`), `expected`가 일치하면 실행·불일치(미리보기 후 최신 버전이 바뀜, 영향 수치가 달라짐)하면 실행하지 않고 409 `PREVIEW_CHANGED`와 최신 미리보기 반환, 관리자 외 403 (FR-029, FR-030, SC-007)
- [ ] T070 [P] [US5] `tests/e2e/history-screen.spec.ts`를 작성한다: 체크박스로 A/B 선택·같은 버전 거부, 요약 개수, 변경 없는 항목 숨김 토글, 단어 강조, 되돌리기 확인 창(영향 목록, 취소 기본 포커스, Esc 닫기, 키보드로 확정), 확정 상태에서는 되돌리기 버튼 대신 안내, 멤버에게는 버튼 없음 (시나리오 18~21)

### Implementation for User Story 5

- [ ] T071 [P] [US5] `src/lib/word-diff.ts`에 어절 토큰 LCS 기반 `wordDiff(before, after)`를 구현해 T067을 통과시킨다
- [ ] T072 [US5] `src/server/services/spec-diff.ts`를 확장해 T068을 통과시킨다. 기존 응답 필드는 유지한다
- [ ] T073 [US5] `src/server/services/revert-preview.ts`에 `previewRevert(user, boardId, featureId, toVersion)`와 순수 계산 함수 `computeRevertImpact(latest, target)`를 구현한다
- [ ] T074 [US5] `src/server/services/spec.ts`의 `revertSpec`이 `computeRevertImpact`를 재사용하고, `expected`가 있으면 일치 여부를 확인해 달라졌으면 409 `PREVIEW_CHANGED`(최신 미리보기 포함)를 던지도록 수정해 T069를 통과시킨다. 오류 코드 `FINALIZED`, `NO_CHANGE`도 응답에 포함한다
- [ ] T075 [US5] `src/app/api/boards/[boardId]/features/[featureId]/spec/revert-preview/route.ts`와 기존 `revert/route.ts`(본문 `expected`, 오류 본문)를 계약대로 구현·수정한다
- [ ] T076 [P] [US5] `src/components/history/VersionCard.tsx`, `CompareBar.tsx`(A/B 체크 상태, 같은 버전 거부, `?a=&b=` 반영, JS 없는 환경은 select 폼 대체), `DiffRow.tsx`(+/−/~ 기호·글자·색, 종류·번호, 출처/새 출처, 이전·이후 단어 강조)를 만든다
- [ ] T077 [US5] `src/components/history/RevertDialog.tsx`에 확인 창을 만든다: 미리보기 호출, "새 버전 vN이 만들어지고 기존 버전은 그대로 남는다" 안내, "항목 N개가 빠집니다"·"해소된 질문 M개가 다시 열립니다" 목록, 기본 포커스 취소, `expected`와 함께 실행, `PREVIEW_CHANGED`이면 갱신된 수치를 보여주고 다시 확인받기, 확정 상태면 안내와 확정 해제 링크 (FR-029, FR-030)
- [ ] T078 [US5] `src/app/boards/[boardId]/features/[featureId]/spec/history/page.tsx`를 시안 2쪽 구조(좌: 버전 카드 목록과 "이전 버전 N개 더 보기", 우: 비교 결과와 요약, "변경 없는 항목도 보기" 토글)로 다시 만든다. 기존 `RevertButton`은 제거한다
- [ ] T079 [US5] 기존 `tests/e2e/spec-flow.spec.ts`의 이력·되돌리기 단계를 새 화면에 맞게 갱신한다

---

## Phase 9: User Story 6 - 출처 인용 발췌 (P2)

**Goal**: 출처를 펼치면 근거 문장이 강조되고, 원문에 없는 발췌는 저장·표시되지 않는다

**Independent Test**: 원문에 있는 발췌는 강조, 없는 발췌는 버려지고 항목은 정상 생성 (시나리오 6~9)

### Tests for User Story 6

- [ ] T080 [P] [US6] `tests/unit/quotes.test.ts`에 `locateQuote(content, quote)` 테스트를 작성한다: 정확히 일치, 공백·줄바꿈만 다른 경우 일치(원문 실제 표기 범위 반환), 원문에 없으면 null, 빈 문자열·500자 초과면 null, 여러 번 나오면 첫 번째 위치, 정규식 특수문자 포함 발췌, 반환 범위가 `0 ≤ start < end ≤ 길이`이고 `end − start ≤ 500` (FR-032)
- [ ] T081 [P] [US6] `tests/integration/spec-quotes.test.ts`에 테스트를 작성한다: 원문에 있는 발췌는 `quoteStart/End`로 저장되고 `getSpec` 출처에 `quote`로 노출, 원문에 없는 발췌는 버려지고 항목·출처 연결은 정상 저장(오류 없음, 작업 DONE), 공백 차이 발췌 인정, 같은 출처를 다시 인용하지 않은 기존 항목의 발췌는 유지, 이전(002) 버전의 출처는 `quote: null`로 오류 없이 표시, 같은 항목의 출처마다 각자의 발췌, 항목이 인용했다고 선언(`sourceInputIds`)하지 않은 입력의 발췌는 무시 (FR-031~FR-033, SC-005)

### Implementation for User Story 6

- [ ] T082 [US6] `src/server/services/quotes.ts`에 `locateQuote`를 구현해 T080을 통과시킨다(공백을 `\s+`로 정규화한 패턴으로 첫 일치를 찾고 원문의 실제 범위를 반환)
- [ ] T083 [US6] `src/server/ai/spec-writer.ts`와 `src/lib/schemas/spec.ts`의 출력 타입·스키마에 `quotes: [{ inputId, quote }]`(빈 배열 허용)를 항목과 질문에 추가한다. `sourceInputIds` 규칙과 기존 검증은 그대로 유지한다
- [ ] T084 [US6] `src/server/services/spec-jobs.ts`의 버전 저장이 새 출처의 발췌를 `locateQuote`로 검증해 `quoteStart/End`를 저장하고(실패하면 null), 기존 항목의 같은 출처에는 이전 버전의 발췌를 유지하도록 수정한다. 발췌 때문에 작업이 실패해서는 안 된다
- [ ] T085 [P] [US6] `src/server/ai/fake-spec-writer.ts`가 입력 본문 앞 문장을 발췌로 제시하도록 하고, 원문에 없는 발췌를 주입하는 옵션(`badQuotes`)을 추가한다
- [ ] T086 [P] [US6] `src/server/ai/claude-spec-writer.ts`의 프롬프트에 "quote는 원문에서 그대로 복사한 한 문장이고 확실하지 않으면 생략한다, 항목·질문마다 새로 인용하는 출처에만 단다" 지시를 추가하고 구조화 출력 스키마에 `quotes`를 반영한다
- [ ] T087 [US6] `src/server/services/spec-view.ts`가 출처의 `quote: {start, end} | null`을 내려주고, `src/components/spec/SourcePanel.tsx`가 발췌가 있으면 원문 구간을 `<mark>`로 강조하되 배경색에만 의존하지 않고 인용 부호와 밑줄을 함께 써서 보여주며(없으면 원문만), "원문 전체 보기(IN-n)" 링크로 입력 화면의 해당 입력으로 이동하도록 한다 (FR-033)
- [ ] T088 [P] [US6] `tests/live/spec-writer.live.test.ts`에 실제 Claude의 발췌 점검을 추가한다(키 있을 때만): 제시된 발췌 중 원문에 실제 존재하는 비율을 계산해 출력하고, 존재하지 않는 발췌가 저장되지 않음을 확인한다

---

## Phase 10: User Story 7 - 로그인, 멤버 관리, 상태 화면 (P3)

**Goal**: 로그인·멤버 관리·빈 상태·오류 상태를 시안 문구와 구조로 정리한다

**Independent Test**: 각 화면과 상태를 만들어 시안 7, 9, 10쪽과 대조한다 (시나리오 21, 23)

- [ ] T089 [P] [US7] `tests/e2e/login-members.spec.ts`를 작성한다: 로그인 실패 안내가 폼 위에 보이고 이메일 값 유지, "계정은 보드 관리자가 추가합니다" 안내, 멤버 관리의 "(나)" 표시와 역할 즉시 저장, 마지막 관리자 강등 시 그 행의 오류와 "역할은 관리자로 유지됩니다", 멤버가 `/boards/[id]/members` 직접 접근 시 403 안내와 내 역할 표시, 없는 보드·feature 주소는 404 (시나리오 21, 23)
- [ ] T090 [US7] `src/app/login/page.tsx`를 시안 9쪽으로 다시 만든다(로고, 한 줄 소개 "회의에서 정한 것을, 근거와 함께 남깁니다.", 오류 안내 폼 위, 이메일 값 유지, 안내 문구). 로그인 실패 시 이메일을 쿼리로 되돌려 채운다 (FR-035)
- [ ] T091 [P] [US7] `src/components/members/MemberTable.tsx`에 멤버 추가 폼과 표(이름, 이메일, 역할, 추가일), "(나)" 표시, 역할 즉시 저장, 행 단위 오류(마지막 관리자 강등), 하단 역할 설명을 만든다(`MemberManager` 대체) (FR-034)
- [ ] T092 [US7] `src/app/boards/[boardId]/members/page.tsx`를 시안 7쪽으로 다시 만들고, 관리자가 아니면 `ForbiddenView`를 렌더링한다. 같은 방식으로 관리자 전용 화면(보드 승인 대기)에도 적용한다 (FR-007)
- [ ] T093 [P] [US7] `src/components/ui/EmptyState.tsx`를 시안 10쪽 문구로 채워 각 화면에 적용한다: 입력 없음("첫 입력 제출"), 승인된 입력 없음("승인 대기 보기"), 필터 결과 없음, 질문만 있고 항목 없음 (FR-036)
- [ ] T094 [US7] `src/components/layout/Breadcrumb.tsx`와 `src/app/not-found.tsx`가 접근 권한이 없는 보드와 존재하지 않는 보드를 구별하지 못하게 한다(둘 다 같은 404 문구)

---

## Phase 11: Polish & Cross-Cutting

- [ ] T095 [P] `tests/e2e/a11y-all-screens.spec.ts`에 모든 화면(로그인, 홈, 입력, 승인 대기, 멤버 관리, spec, 이력, 403, 404, 빈·오류 상태)을 라이트·다크로 axe 점검해 위반 0건임을 확인한다(color-contrast 포함) (SC-001, SC-003)
- [ ] T096 [P] `tests/e2e/keyboard.spec.ts`에 키보드만으로 제출, 승인, 반려, 출처 펼침, 필터, 비교 선택, 되돌리기, 확정·해제를 수행하는 시나리오와 확인 창의 포커스 가둠·Esc 닫기를 작성한다 (SC-002)
- [ ] T097 [P] `tests/e2e/responsive.spec.ts`에 휴대폰 너비(375px)에서 spec 보기와 입력 제출 화면에 가로 스크롤이 없고 질문이 항목 위에 있음을 확인한다 (시나리오 24, SC-010)
- [ ] T098 [P] `tests/integration/api-authz-v3.test.ts`에 새 API 전부(`/home`, `/pending`, `/pending/count`, `inputs/view`, `revert-preview`)의 권한 매트릭스(data-model.md)와 서비스 함수의 `requireRole` 통과를 점검한다 (FR-007, SC-008)
- [ ] T099 [P] `tests/integration/latency-v3.test.ts`에 홈 요약, 보드 승인 대기, 입력 뷰, 되돌리기 미리보기의 서버 처리 p95가 300ms 이내인지 확인한다(보드 입력 1,000개, feature 20개 규모)
- [ ] T100 [P] 남은 구 스타일(`src/app/globals.css`)과 사용되지 않는 구 컴포넌트를 제거하고 `npx eslint .`, `npx tsc --noEmit`, `npx next build`가 통과함을 확인한다(글꼴 내려받기에 네트워크가 필요하므로 오프라인이면 시스템 글꼴 대체로 빌드가 계속되는지도 확인하고 결과를 quickstart에 기록)
- [ ] T101 [P] `specs/003-design-system-ui/quickstart.md`의 "실행" 절을 실제 스크립트 명령으로 갱신한다(`db:verify-numbering`, axe 포함 E2E)
- [ ] T102 `design-parity.md`의 모든 항목을 시안 PDF와 화면을 나란히 열어 직접 확인하고 체크한다. 범위 밖으로 명시한 요소가 들어가지 않았는지도 확인한다 (SC-011)
- [ ] T103 quickstart.md 시나리오 1~25를 처음부터 끝까지 수행해 결과를 확인한다(실제 Claude 발췌 확인은 키가 있을 때 T088과 함께)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US8(Phase 3) → 나머지 스토리. Phase 2가 모든 스토리를 막고, US8의 토큰·공용 컴포넌트·헤더가 모든 화면 작업을 막는다.
- **US1(spec 화면)**: T034~T035는 Phase 2의 T010·T013·T015 이후. 화면 작업(T036~T041)은 US8 이후.
- **US2(입력 화면)**: US1과 독립이지만 `InputDto.number`(T046)를 US1의 출처 번호가 같은 직렬화를 공유하므로 T034와 충돌하지 않게 순서를 맞춘다.
- **US3(승인 대기)**: US8의 헤더(T030) 이후, T058이 T030을 완성한다. T053의 승인 흐름 E2E는 T060 이후 확정.
- **US4(홈)**: Phase 2의 T013(`deriveSpecStatus`) 이후 독립.
- **US5(이력)**: T072는 T034의 직렬화 확장 이후, T074는 T016(오류 확장) 이후.
- **US6(발췌)**: T082~T084는 Phase 2 이후 독립 진행 가능하나, T087은 T038(SourcePanel) 이후.
- **US7**: US8 이후 독립.
- 같은 파일을 만지는 태스크는 순서대로: `spec.ts`(T013, T035, T074), `spec-jobs.ts`(T010, T084), `spec-view.ts`(T034, T087), `inputs.ts`(T008, T046, T047), `components.css`(T026, T042 이후 다른 스토리의 추가).
- 각 스토리 안에서는 테스트 → 서비스 → API → 컴포넌트 → 페이지 순.

### 병렬 기회

- Phase 2: T004, T006, T007, T009, T011, T012, T014, T016
- US8: T017~T020, T022~T024, T027, T031
- 스토리별 테스트 태스크(각 Phase의 [P])
- US3·US4·US7은 서로 독립이라 병렬 진행 가능
- Polish: T095~T101

## Implementation Strategy

1. **MVP**: Phase 1 → 2 → US8 → US1 → US2. 제품의 핵심 두 화면(spec, 입력)과 기반(토큰, 번호, 접근성)이 시안대로 갖춰진다.
2. 이어서 US3(보드 승인 대기), US4(홈), US5(이력·미리보기), US6(발췌)을 추가한다. US6은 AI 출력 형식을 바꾸므로 키가 있으면 T088로 실제 Claude 확인을 병행한다.
3. 마지막으로 US7과 Polish(접근성, 키보드, 반응형, 성능, 시안 대조).
4. 마이그레이션(T003)은 되돌리기 어려우므로 개발 DB에 적용하기 전에 `pg_dump`로 백업하는 것을 권장한다(T005 전).
