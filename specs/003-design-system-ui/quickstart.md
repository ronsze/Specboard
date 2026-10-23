# Quickstart: 디자인 시안 적용 검증

## 사전 준비
- 001·002 실행 준비가 끝난 상태 (`specs/001-input-approval/quickstart.md`, `specs/002-ai-spec-versions/quickstart.md`)
- 개발 DB에 001·002로 쌓인 데이터가 있으면 backfill 검증에 그대로 쓴다
- 키 없이 확인하려면 `.env`에 `SPEC_WRITER=fake`

## 실행
1. `npm run db:migrate` — 번호·인용 컬럼 추가와 기존 데이터 번호 부여(backfill). 개발 DB에 적용하기 전에 `pg_dump`로 백업하는 것을 권장한다
2. `npm run db:verify-numbering` — 입력·항목·질문 번호의 중복·누락·카운터 불일치를 점검하고 종류가 바뀐 key 수를 보고한다
3. `npm run dev` 후 시드 계정으로 로그인 (`admin@specboard.local`, `member@specboard.local`, `viewer@specboard.local`, 비밀번호 `specboard123`). 키 없이 AI 동작을 보려면 `.env`에 `SPEC_WRITER=fake`
4. 테스트: `npm test`(단위·통합, 실제 PostgreSQL), `npm run test:e2e`(화면 흐름, 키보드, 반응형, axe 접근성 라이트·다크), 실제 Claude 점검 `npm run test:live`(키가 있을 때만, 비용 발생)
5. 개발 전용 UI 키트: http://localhost:3000/dev/ui-kit (프로덕션에서는 404)

글꼴(IBM Plex)은 `next/font/google`이 빌드·개발 중 내려받는다. 네트워크가 없으면 시스템 글꼴로 대체되어 표시된다.

## 검증 시나리오

| # | 시나리오 | 기대 결과 | 관련 |
|---|---|---|---|
| 1 | 마이그레이션 후 개발 DB 점검 | 모든 입력에 보드별 유일 번호, 모든 항목에 종류별 번호, 기존 내용·출처·버전 불변 | FR-013, SC-009 |
| 2 | 입력 여러 개를 동시에 제출 | 번호 중복·결번 없음 | FR-010 |
| 3 | spec에 결정 2개·요구사항 3개 | D-1, D-2, R-1~R-3 표시와 개수 요약, 문구가 바뀌어도 번호 유지, 되돌리기 후에도 유지 | FR-011, FR-012 |
| 4 | 항목이 v3에서 생기고 v7에서 바뀜 | "v3부터", 최신이 v7이면 "v7에서 변경", 바뀌지 않은 항목은 변경 표시 없음 | FR-012 |
| 5 | 항목 출처 열기 | 클릭 두 번 이내에 입력 번호·종류·제출자·시각·상태·원문 확인 | FR-023, SC-004 |
| 6 | AI가 원문에 있는 문장을 발췌로 제시 | 출처를 펼치면 그 문장이 강조, "원문 전체 보기" 이동 | FR-031~FR-033 |
| 7 | AI가 원문에 없는 문장을 발췌로 제시(가짜 AI) | 발췌 없이 원문만 표시, 항목은 정상 생성, 오류 없음 | FR-032, SC-005 |
| 8 | 공백·줄바꿈만 다른 발췌 | 일치로 인정, 원문 표기대로 강조 | FR-032 |
| 9 | 002 이전에 만든 버전의 출처 | 발췌 없이 원문 표시, 오류 없음 | FR-033 |
| 10 | 입력 목록 필터 4종 | 개수와 목록이 가시성 규칙 안에서 일치, 새로고침 후 유지 | FR-016 |
| 11 | 긴 회의록 | 접힘, 전체 글자 수, 펼치기 | FR-015 |
| 12 | 멤버의 대기 입력 | "나와 관리자에게만 보임", 다른 멤버에게는 안 보임 | FR-016 |
| 13 | 서로 다른 feature에 대기 입력 | 보드 승인 대기 한 화면에 모이고 feature 링크 표시, 승인·반려 후 배지 숫자 갱신, 0이면 배지 숫자 숨김, 100 이상이면 "99+" | FR-018~FR-020, SC-006 |
| 14 | 사유 없이 반려 | 확정 불가. 사유 입력 후 가능, 취소 가능 | FR-020 |
| 15 | 다른 관리자가 먼저 처리한 입력 처리 시도 | "이미 처리되었습니다"와 목록 갱신 | FR-020 |
| 16 | 홈 | 보드별 내 역할, feature별 상태·버전·날짜·반영 대기 수, 관리자 보드에만 승인 대기·멤버 관리 | FR-021 |
| 17 | spec 화면 상태 | 갱신 중(읽는 입력 수), 실패(마지막 성공 버전 유지, 시도 횟수·시각, 관리자만 재시도), 확정(확정자·시각, 해제 시 반영될 수), 입력 없음 | FR-024, FR-025 |
| 18 | 이력에서 A/B 선택 | 두 버전 비교, 같은 버전은 거부, 요약 개수, 단어 단위 강조, 새 출처, 동일 항목 숨김 토글 | FR-027, FR-028 |
| 19 | 되돌리기 확인 창 | 영향 수치가 실제 결과와 일치, 기본 포커스는 취소, Esc로 닫힘 | FR-029, SC-007 |
| 20 | 확인 창을 연 뒤 spec이 확정되거나 영향이 달라짐 | 실행하지 않고 최신 안내 후 재확인 | FR-030 |
| 21 | 권한별 화면(관리자·멤버·열람자) | 허용되지 않는 동작·메뉴가 보이지 않음, 상단 역할 배지, 직접 주소 접근 시 403/404 안내 | FR-006, FR-007, SC-008 |
| 22 | 모든 화면 접근성 | 라이트·다크 axe 위반 0, 키보드만으로 모든 동작, 포커스 링, 확인 창 포커스 가둠 | SC-001~SC-003 |
| 23 | 로그인·멤버 관리 | 시안 문구, 마지막 관리자 강등 오류 행, "(나)" 표시, 즉시 저장 | FR-034, FR-035 |
| 24 | 휴대폰 너비 spec 보기·입력 제출 | 가로 스크롤 없음, 질문이 항목 위 | FR-009, SC-010 |
| 25 | 시안 대조 | `design-parity.md` 점검표 전 항목 확인 | SC-011 |

계약 상세: [contracts/openapi.yaml](contracts/openapi.yaml), 데이터 규칙: [data-model.md](data-model.md), 시안 대조: [design-parity.md](design-parity.md)

## 자동화 매핑

| 시나리오 | 검증하는 테스트 |
|---|---|
| 1 | `scripts/verify-numbering.ts`(개발 DB) |
| 2 | `numbering.test.ts` |
| 3, 4 | `spec-numbering.test.ts`, `spec-provenance.test.ts`, `spec-view.test.ts`, `spec-screen.spec.ts` |
| 5 | `spec-screen.spec.ts`, `spec-sources.test.ts` |
| 6~9 | `quotes.test.ts`, `spec-quotes.test.ts` (실제 Claude 발췌 일치율은 `tests/live`, 키 필요) |
| 10~12 | `input-view.test.ts`, `inputs-screen.spec.ts` |
| 13~15 | `board-pending.test.ts`, `board-pending.spec.ts` |
| 16 | `home.test.ts`, `home.spec.ts` |
| 17 | `spec-view.test.ts`, `spec-screen.spec.ts` |
| 18~20 | `spec-diff-v2.test.ts`, `word-diff.test.ts`, `revert-preview.test.ts`, `history-screen.spec.ts` |
| 21 | `api-authz-v3.test.ts`, `login-members.spec.ts`, `board-pending.spec.ts` |
| 22 | `a11y-all-screens.spec.ts`, `ui-kit.spec.ts`, `keyboard.spec.ts` |
| 23 | `login-members.spec.ts` |
| 24 | `responsive.spec.ts` |
| 25 | `design-parity.md`를 시안과 나란히 열어 사람이 확인 (자동화 불가) |
| 성능 | `latency-v3.test.ts` |
