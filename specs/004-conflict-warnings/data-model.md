# Data Model: 충돌 경고

001~003의 엔티티는 그대로 사용한다. 아래는 추가분이다 (Input, SpecItem 등은 변경 없음).

## ConflictCheck (검사 기록이자 작업 큐 행)

| 필드 | 설명 |
|---|---|
| id | |
| inputId | 검사 대상 입력 (입력 삭제 시 함께 삭제) |
| boardId | 보드 id 비정규화 (보드 단위 승인 대기 조회용) |
| featureId | feature id 비정규화 |
| status | `QUEUED` \| `RUNNING` \| `DONE` \| `FAILED` \| `SKIPPED` |
| skipReason | status가 `SKIPPED`일 때 `NO_SPEC` \| `NO_ITEMS` |
| lastError | status가 `FAILED`일 때 `REFUSED` \| `INVALID_OUTPUT` \| `API_ERROR` \| `TIMEOUT` \| `TOO_LARGE` |
| attempts | 시도 횟수 (자동 재시도 최대 3회) |
| baseVersionNumber | 비교에 쓴 spec 버전 번호 (검사 완료 시 저장 시점의 최신) |
| model | 검사에 쓴 모델 id (기록용) |
| leaseUntil | RUNNING의 임대 만료 시각 |
| runAfter | 이 시각 이후에 claim 가능 (재시도 백오프) |
| createdAt, updatedAt, completedAt | |

- 불변식: 입력당 `QUEUED` 또는 `RUNNING` 검사는 최대 1개 (부분 유니크 인덱스 `(inputId) WHERE status IN ('QUEUED','RUNNING')`)
- "현재 결과" = 입력의 가장 최근 검사 (`createdAt DESC, id DESC`). 이전 검사와 그 경고는 보존된다
- 인덱스: `(boardId, status)`, `(inputId, createdAt)`

## ConflictWarning

| 필드 | 설명 |
|---|---|
| id | |
| checkId | 이 경고를 만든 검사 |
| inputId | 대상 입력 (조회 편의를 위한 비정규화) |
| itemKey | 충돌 가능성이 있는 spec 항목의 안정 key |
| itemKind, itemNumber | 항목 종류와 번호 (표시 라벨 `D-n`/`R-n`) |
| itemText | 경고를 만든 시점의 항목 문구 (스냅샷) |
| onFinalizedSpec | 경고를 만든 시점에 spec이 확정 상태였는가 |
| reason | 어긋난다고 보는 한 줄 이유 (공백 제외 1자 이상 200자 이하) |
| quoteStart, quoteEnd | 입력 원문 중 근거 발췌 구간. 원문에 없으면 둘 다 null. `0 ≤ quoteStart < quoteEnd ≤ 원문 길이`, `quoteEnd − quoteStart ≤ 500` |
| acknowledgedAt, acknowledgedBy, acknowledgedByName | 관리자가 "확인함"으로 닫은 시각·사람. null이면 열림 |
| createdAt | |

- 유니크: `(checkId, itemKey)` — 한 검사에서 같은 항목 경고는 하나
- 검사당 경고 최대 5개 (서버 검증)
- 경고는 수정되지 않는다. 변경되는 것은 확인 필드뿐이며 한 번 설정되면 바뀌지 않는다

## 상태 전이

```text
(멤버 제출) ─ spec 없음/항목 없음 ─────────────► SKIPPED (즉시, AI 호출 없음)
          └ spec 있음 ─► QUEUED ─ claim ─► RUNNING ─ 검증 후 저장 ─► DONE (경고 0..5개)
                          ▲                   │ 실패(재시도 가능, 3회 미만)
                          └── runAfter 백오프 ┘
                                              │ 3회 소진 / REFUSED / TOO_LARGE
                                              ▼
                                           FAILED ──(관리자 다시 검사, 입력이 PENDING)──► 새 ConflictCheck(QUEUED)
```

- 입력이 승인·반려되어도 진행 중인 검사는 끝까지 수행된다. 완료되면 경고는 "처리됨(승인됨/반려됨)"으로 표시된다
- DONE·SKIPPED·이미 진행 중인 검사, 또는 입력이 PENDING이 아닐 때의 다시 검사는 거부된다

## 화면용 조회 모델 (저장하지 않음)

**ConflictView** (관리자에게만 생성):

| 필드 | 설명 |
|---|---|
| state | `CHECKING`(QUEUED·RUNNING) \| `DONE` \| `FAILED` \| `SKIPPED` |
| skipReason | SKIPPED일 때 `NO_SPEC` \| `NO_ITEMS` |
| failure | FAILED일 때 `{ code, attempts }` |
| warnings | 경고 목록(확정 충돌 먼저, 그다음 생성 순). 각 경고: `id, label, kind, itemText, onFinalizedSpec, reason, quote({start,end}\|null), acknowledged({byName, at}\|null)` |
| unacknowledgedCount | 열린 경고 수 |
| checkedAt | 최근 완료 시각 |
| processedAs | 입력이 APPROVED/REJECTED이면 그 값, PENDING이면 null |

- 입력에 검사 기록이 전혀 없으면(이 feature 이전의 입력, 관리자 제출) `conflict`는 `null`이다 — 화면에 검사 표시 없음

## 검증 규칙 → 요구사항 매핑

| 규칙 | 요구사항 |
|---|---|
| 저장 시점의 최신 버전에 없는 `itemKey` 경고 폐기 | FR-005, SC-003 |
| 발췌는 `locateQuote`로 확인, 실패 시 null(경고 유지) | FR-004, SC-004 |
| 항목당 1개, 입력당 최대 5개, 이유 길이 | FR-006 |
| `onFinalizedSpec` 기록과 구분 표시 | FR-007, SC-006 |
| 검사 행이 없거나 SKIPPED면 AI 미호출 | FR-010, FR-011 |
| 입력당 활성 검사 1개(부분 유니크), 원자적 claim | 엣지 케이스(동시 검사 금지) |
| FAILED이고 PENDING일 때만 재시도 | FR-014 |
| 확인 필드는 한 번만 설정, 입력 상태 불변 | FR-016, FR-017 |
| 비관리자 응답에 `conflict` 필드를 만들지 않음 | FR-019, SC-005 |
| 제출·승인 경로에서 검사 오류를 삼킴 | FR-013, SC-002 |

## 권한 매트릭스 (서버 강제)

| 동작 | ADMIN | MEMBER | VIEWER | 제출자 본인 | 비멤버 |
|---|---|---|---|---|---|
| 검사 상태·경고 조회 | O | X | X | X (멤버 역할일 때 동일) | X |
| 경고 확인(닫기) | O | X | X | X | X |
| 다시 검사 | O | X | X | X | X |
