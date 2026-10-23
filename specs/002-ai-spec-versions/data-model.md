# Data Model: AI spec 생성과 버전 이력

001의 User, Board, Membership, Project, Feature, Input은 그대로 사용한다. 아래는 추가·변경분이다.

## 변경: Input

| 필드 | 설명 |
|---|---|
| consumedAt | 어떤 spec 버전에 반영된 시각. null이면 "반영 대기"(승인되었으나 아직 반영 전). 한 번 설정되면 되돌리기로도 지우지 않는다 |
| consumedVersionId | 반영한 SpecVersion |

- 재료 후보 = `status = APPROVED AND consumedAt IS NULL`, 정렬은 `decidedAt, id`(승인 순서)

## 신규 엔티티

### Spec
- id, featureId(유니크), currentVersionId(nullable), finalizedAt, finalizedBy(userId, nullable), createdAt
- 확정 상태 = `finalizedAt IS NOT NULL`

### SpecVersion (불변)
| 필드 | 설명 |
|---|---|
| id, specId | |
| number | feature 내 1부터 증가, `(specId, number)` 유니크 |
| kind | `AI_UPDATE` \| `REVERT` |
| revertedFromNumber | REVERT일 때 대상 버전 번호 |
| createdBy | REVERT일 때 관리자 userId, AI_UPDATE는 null |
| createdAt | |
| model | AI_UPDATE에 사용한 모델 id (기록용) |

### SpecVersionInput
- versionId, inputId (복합 키): 이 버전을 만든 근거 입력 목록(FR-010). REVERT 버전은 비어 있다

### SpecItem
| 필드 | 설명 |
|---|---|
| id, versionId | |
| key | 항목의 안정 식별자. 버전이 바뀌어도 같은 항목은 같은 key (비교·출처 추적용) |
| kind | `DECISION` \| `REQUIREMENT` |
| text | 항목 내용. 공백 제외 1자 이상 2,000자 이하 |
| position | 표시 순서 |

### SpecItemSource
- itemId, inputId (복합 키). 항목당 1개 이상 필수(FR-004). 입력은 같은 feature의 승인된 입력이어야 한다

### OpenQuestion
| 필드 | 설명 |
|---|---|
| id, versionId, key | 안정 식별자 |
| text | 질문 내용, 1자 이상 1,000자 이하 |
| status | `OPEN` \| `RESOLVED` |
| resolvedByInputId | RESOLVED일 때 필수(FR-008). 답이 된 입력 |
| position | |

- OpenQuestion의 출처: 질문을 만든 입력(`OpenQuestionSource`, 항목과 같은 구조). 질문도 출처 없이 생성되지 않는다(원칙 I)

### SpecJob
| 필드 | 설명 |
|---|---|
| id, featureId | |
| status | `QUEUED` \| `RUNNING` \| `FAILED` \| `DONE` |
| attempts | 시도 횟수 (자동 재시도 최대 3회, 지수 백오프) |
| lastError | 실패 사유 코드 (`REFUSED`, `INVALID_OUTPUT`, `API_ERROR`, `TIMEOUT`) |
| leaseUntil | RUNNING의 임대 만료 시각. 만료되면 다른 워커가 회수 |
| createdAt, updatedAt | |

- 불변식: feature당 `QUEUED` 또는 `RUNNING` 작업은 최대 1개(부분 유니크 인덱스)

## 상태와 전이

```text
Spec 표시 상태 = FINALIZED  (finalizedAt 설정)
               | UPDATING   (QUEUED/RUNNING 작업 존재)
               | FAILED     (최신 작업이 FAILED이고 반영 대기 입력 존재)
               | IDLE       (그 외)
               | NONE       (Spec 또는 버전이 없고 승인된 입력도 없음)

입력 승인 ──► (확정 아님) ──► 작업 등록 ──► 갱신 ──► 새 버전, 입력 consumedAt 설정
          └─► (확정됨)  ──► 등록 안 함, 입력은 "반영 대기"로 남음
확정 해제 ──► 반영 대기 입력이 있으면 작업 등록
되돌리기(관리자, 비확정) ──► 선택 버전 스냅샷을 복사한 REVERT 버전 생성 (같은 내용이면 거부)
```

## 검증 규칙 → 요구사항 매핑

| 규칙 | 요구사항 |
|---|---|
| 모든 SpecItem에 SpecItemSource 1개 이상, 출처는 같은 feature의 APPROVED 입력 | FR-003, FR-004, FR-006 |
| 새 항목·문구가 바뀐 항목은 이번 반영 입력을 1개 이상 인용 | FR-006, FR-010 |
| RESOLVED 질문은 resolvedByInputId 필수 | FR-008 |
| SpecVersion·항목·질문은 생성 후 수정 불가 | FR-009 |
| 버전 번호는 feature 락 안에서 발급, `(specId, number)` 유니크 | FR-011 |
| 입력은 한 번만 소비(`consumedAt IS NULL` 조건부 갱신) | FR-011 |
| 확정 상태에서는 작업 등록·되돌리기 거부 | FR-018, FR-020 |
| 최신 버전과 항목·질문 내용이 같은 버전으로 되돌리기 거부 | FR-016 |
| 작업 실패 시 Spec·버전·입력 상태 불변 | FR-023 |

## 권한 매트릭스 (서버 강제)

| 동작 | ADMIN | MEMBER | VIEWER | 비멤버 |
|---|---|---|---|---|
| spec, 출처, 미결 질문, 이력, 비교 열람 | O | O | O | X |
| 되돌리기, 확정, 확정 해제, 갱신 재시도 | O | X | X | X |
