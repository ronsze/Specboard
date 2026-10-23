# Quickstart: 충돌 경고 검증

## 사전 준비
- 001~003 실행 준비가 끝난 상태. 키 없이 확인하려면 `.env`에 `SPEC_WRITER=fake`(가짜 AI가 spec 생성과 충돌 검사 모두를 대신한다)
- 실제 Claude로 확인하려면 `ANTHROPIC_API_KEY`(저장소에 커밋하지 않는다), 선택으로 `CONFLICT_MODEL`

## 실행
1. `npm run db:migrate` — `ConflictCheck`, `ConflictWarning` 추가 (적용 전 `pg_dump` 백업 권장)
2. `.env`에 `SPEC_WRITER=fake`(가짜 AI가 spec 생성과 충돌 검사를 모두 대신한다: 입력에 "두 장·불가·제한·허용하지" 같은 표식이 있고 항목과 어절이 겹치면 경고). 실제 Claude는 `SPEC_WRITER=claude`와 `ANTHROPIC_API_KEY`, 선택으로 `CONFLICT_MODEL`
3. `npm run dev` → 멤버로 입력을 제출하고 관리자로 승인 대기 화면에서 확인
4. 테스트: `npm test`(가짜 AI + 실제 PostgreSQL), `npm run test:e2e`(실행 전에 이전 E2E가 남긴 데이터를 정리한다), 실제 Claude 평가 `npm run test:live`(키가 있을 때만, 비용 발생. 탐지율·오탐률·호출 p95를 출력)

## 검증 시나리오

| # | 시나리오 | 기대 결과 | 관련 |
|---|---|---|---|
| 1 | spec이 있는 feature에서 멤버가 입력 제출 | 제출은 즉시 완료되고 입력은 대기. 관리자 화면에 "검사 중" 후 결과로 바뀜 | FR-001, FR-012 |
| 2 | 확정된 spec의 D-1과 모순되는 입력 | 입력 카드에 "확정된 결정과 충돌 가능" 경고: D-1 번호·문구, 한 줄 이유, 원문 발췌 | FR-003, FR-007 |
| 3 | 확정되지 않은 spec의 항목과 모순 | 경고가 보이되 확정 충돌과 문구·아이콘·강조가 다름 | FR-007, SC-006 |
| 4 | 모순 없는 입력 | "충돌 가능성 없음"(검사 완료) | FR-012 |
| 5 | 열려 있는 미결 질문에 답하는 입력 | 충돌로 표시되지 않음 | FR-009 |
| 6 | AI가 존재하지 않는 항목 key를 내놓음(가짜 AI) | 그 경고는 저장·표시되지 않음 | FR-005, SC-003 |
| 7 | 검사 도중 spec 되돌리기로 항목이 사라짐 | 사라진 항목을 가리키는 경고는 저장되지 않음 | FR-005 |
| 8 | AI가 원문에 없는 발췌를 줌 | 발췌 없이 이유만 표시, 경고는 유지 | FR-004, SC-004 |
| 9 | 항목이 같은 경고 중복·6개 이상 | 항목당 1개, 최대 5개만 저장 | FR-006 |
| 10 | 경고가 있는 입력을 승인 / 반려 | 추가 확인 없이 처리됨 | FR-008, SC-002 |
| 11 | 검사 실패(가짜 AI 오류) | "검사 실패" 표시, 제출·승인에는 영향 없음 | FR-013 |
| 12 | 관리자가 다시 검사 | 새 검사 기록, 최신 결과로 표시, 이전 기록 보존 | FR-014, FR-015 |
| 13 | 성공한 검사·처리된 입력·진행 중 검사에 다시 검사 | 409(사유 코드) | FR-014 |
| 14 | spec이 없는 feature의 입력 | AI 호출 없이 "비교할 spec 없음 · 경고 없음" | FR-010 |
| 15 | 관리자가 직접 제출(자동 승인) | 검사 표시 없음 | FR-011 |
| 16 | 경고를 "확인함"으로 닫음 | 확인자·시각 기록, 접힌 상태로 남아 다시 볼 수 있음, 입력 상태 불변, 클릭 두 번 이내 | FR-016, FR-017, SC-007 |
| 17 | 입력 승인 후 feature 입력 화면(관리자 보기) | 경고가 "처리됨(승인됨)"으로 남음, 반려도 동일 | FR-018, SC-008 |
| 18 | 검사 중에 입력이 승인·반려됨 | 검사는 끝까지 수행되어 결과가 처리됨으로 남음 | FR-021 |
| 19 | 멤버·열람자·제출자 본인의 화면과 API | 검사 상태·경고가 어디에도 없음(응답에 필드 없음) | FR-019, SC-005 |
| 20 | 멤버·열람자의 확인·다시 검사 | 403 | FR-020 |
| 21 | 보드 승인 대기 목록 | 경고가 있는 입력과 미확인 경고 수를 알아볼 수 있음 | FR-024 |
| 22 | 확정 해제 후에도 기존 경고 | 경고를 만든 시점 기준 표시 유지 | 엣지 케이스 |
| 23 | 접근성 | 새 화면 요소의 라이트·다크 axe 위반 0, 키보드 조작 | 003 SC-001~003 |
| 24 | 실제 Claude 평가 세트 | 모순 입력 80% 이상 경고, 모순 없는 입력 오탐 20% 이하 | SC-009 |

계약 상세: [contracts/openapi.yaml](contracts/openapi.yaml), 데이터 규칙: [data-model.md](data-model.md)

## 자동화 매핑

| 시나리오 | 검증하는 테스트 |
|---|---|
| 1~5, 10, 21 | `conflict-checks.test.ts`, `conflict-view.test.ts`, `conflict-nonblocking.test.ts`, `conflict-warnings.spec.ts` |
| 6~9 | `validate-conflicts.test.ts`, `conflict-validation.test.ts` |
| 11~13 | `conflict-failure.test.ts`, `conflict-retry.test.ts`, `conflict-retry.spec.ts` |
| 14 | `conflict-skip.test.ts` |
| 15 | `conflict-checks.test.ts` |
| 16, 20 | `conflict-acknowledge.test.ts`, `conflict-acknowledge.spec.ts` |
| 17 | `conflict-processed.test.ts`, `conflict-processed.spec.ts` |
| 18 | `conflict-midflight.test.ts` |
| 19 | `conflict-visibility.test.ts` + 각 E2E의 멤버·열람자 확인 |
| 22 | `conflict-checks.test.ts` |
| 23 | `a11y-conflicts.spec.ts` |
| 24 | `tests/live/conflict-detector.live.test.ts` (키 필요) |
| 성능 | `latency-v4.test.ts` |
