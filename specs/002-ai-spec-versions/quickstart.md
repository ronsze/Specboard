# Quickstart: AI spec 생성과 버전 이력 검증

## 사전 준비
- 001-input-approval의 실행 준비(`specs/001-input-approval/quickstart.md`)가 끝난 상태
- 실제 Claude로 확인하려면 `.env`에 `ANTHROPIC_API_KEY`를 추가(저장소에 커밋하지 않는다). 키가 없으면 가짜 AI(`SPEC_WRITER=fake`)로 동작을 확인한다
- 선택: `SPEC_MODEL`로 모델 교체(기본 `claude-opus-5-5`)

## 실행
1. 001의 실행 준비(`npm install`, `npm run db:up`, `npm run db:migrate`, `npm run db:seed`)를 마친다. 새 마이그레이션은 `db:migrate`가 적용한다
2. 키 없이 동작을 보려면 `.env`에 `SPEC_WRITER=fake`를 둔다(결정적인 가짜 AI: "?"로 끝나는 입력은 미결 질문, "답:"으로 시작하면 질문 해소, 그 외는 항목으로 추가). 실제 Claude를 쓰려면 `SPEC_WRITER=claude`와 `ANTHROPIC_API_KEY`(저장소에 커밋하지 않는다), 선택으로 `SPEC_MODEL`(기본 `claude-opus-5-5`)을 설정한다
3. `npm run dev` 후 입력을 제출·승인하면 feature의 "spec 보기"에서 결과를 본다
4. 테스트: `npm test`(가짜 AI + 실제 PostgreSQL), E2E `npm run test:e2e`(`SPEC_WRITER=fake`로 서버를 띄운다), 실제 Claude 점검 `npm run test:live`(키가 있을 때만 실행되고 비용이 발생한다)

## 검증 시나리오

| # | 시나리오 | 기대 결과 | 관련 |
|---|---|---|---|
| 1 | 입력을 승인(또는 관리자 제출) | 새 spec 버전이 생기고 입력 내용이 반영됨 | FR-002 |
| 2 | spec이 있는 feature에서 새 입력 승인 | 기존 버전 보존, 새 버전 추가 | FR-009 |
| 3 | 대기·반려 입력이 있는 상태에서 갱신 | 그 내용이 어느 버전에도 없음 | FR-003, SC-003 |
| 4 | 여러 입력을 거의 동시에 승인 | 모두 빠짐없이 한 번씩만 반영, 중복 없음 | FR-011 |
| 5 | 항목의 출처 열람 | 근거 입력의 종류·제출자·시각·내용 표시 | FR-005 |
| 6 | 한 줄 아이디어만 승인 | 입력에 없는 세부는 미결 질문으로 남음 | FR-007, SC-004 |
| 7 | 질문에 답하는 입력 승인 | 질문이 해소되고 답이 항목으로 반영, 출처 연결 | FR-008 |
| 8 | 모델이 출처 없는 항목을 내놓는 경우(가짜 AI) | 저장되지 않고 작업 FAILED, 기존 버전 불변 | FR-006, FR-023 |
| 9 | 버전 이력과 두 버전 비교 | 번호·시각·근거 입력, 추가/삭제/변경 구분 | FR-010, FR-012, FR-013 |
| 10 | 관리자가 버전 1로 되돌리기 | 같은 내용의 새 버전 생성, 기존 버전 전부 보존, "버전 1로 되돌림" 표시 | FR-014, FR-015, SC-006 |
| 11 | 최신과 같은 내용으로 되돌리기 | 새 버전 없이 안내 | FR-016 |
| 12 | 멤버·열람자의 되돌리기·확정·해제·재시도 | 403 | FR-022, SC-009 |
| 13 | 확정 후 새 입력 승인 | 새 버전 없음, 입력은 "반영 대기" | FR-017, FR-018, SC-008 |
| 14 | 확정 상태에서 되돌리기 | 409 | FR-020 |
| 15 | 확정 해제 | 대기 입력이 승인 순서대로 반영되어 새 버전 | FR-019 |
| 16 | AI 호출 실패(가짜 AI 오류) | 기존 버전·입력 승인 상태 불변, 실패 표시, 재시도 가능 | FR-023 |
| 17 | 갱신 중 상태 표시 | UPDATING 표시 | FR-024 |
| 18 | 승인된 입력이 없는 feature | 안내 문구 | FR-025 |
| 19 | 비멤버 열람 | 403 | FR-021 |
| 20 | 갱신 중에 관리자가 되돌리기·확정 | AI 결과가 덮어쓰지 않고 폐기·재큐 | 설계 규칙 |

계약 상세: [contracts/openapi.yaml](contracts/openapi.yaml), 데이터 규칙: [data-model.md](data-model.md)

## 자동화 매핑

| 시나리오 | 검증하는 테스트 |
|---|---|
| 1~4 | `spec-jobs.test.ts`, `spec-jobs-concurrency.test.ts` |
| 5~7 | `spec-sources.test.ts`, `spec-questions.test.ts`, `validate-output.test.ts` |
| 8, 16 | `spec-jobs-failure.test.ts` |
| 9, 19 | `spec-history.test.ts`, `diff.test.ts` |
| 10~12 | `spec-revert.test.ts`, `spec-authz.test.ts` |
| 13~15 | `spec-finalize.test.ts` |
| 17, 18 | `spec-status.test.ts` |
| 20 | `spec-midflight.test.ts`, `spec-finalize-midflight.test.ts` |
| 화면 흐름 전체 | `tests/e2e/spec-flow.spec.ts` |
| 실제 Claude 품질(SC-002, SC-004) | `tests/live/spec-writer.live.test.ts` (키 필요) |
