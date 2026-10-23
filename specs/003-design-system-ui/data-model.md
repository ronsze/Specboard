# Data Model: 디자인 시안 적용

001·002의 엔티티는 그대로 사용한다. 아래는 추가·변경분이다.

## 변경: Board

| 필드 | 설명 |
|---|---|
| inputSeq | 마지막으로 부여한 입력 번호(카운터). 기본 0 |

## 변경: Input

| 필드 | 설명 |
|---|---|
| boardId | feature → project → board를 비정규화한 보드 id. 보드 단위 조회와 번호 유니크에 사용. 생성 시 설정 후 변하지 않는다 |
| number | 보드 안에서 유일한 입력 번호(표시 `IN-{number}`). 한 번 부여되면 변하지 않고 재사용되지 않는다 |

- 유니크: `(boardId, number)`
- 인덱스: `(boardId, status, submittedAt)` — 보드 단위 승인 대기 조회
- 할당: 제출 트랜잭션 안에서 `UPDATE Board SET inputSeq = inputSeq + 1 WHERE id = $1 RETURNING inputSeq` 결과를 `number`로 사용. 제출이 실패(롤백)하면 번호도 함께 롤백되어 결번이 생기지 않는다

## 변경: Spec

| 필드 | 설명 |
|---|---|
| decisionSeq | 마지막으로 부여한 결정(D) 번호 카운터. 기본 0 |
| requirementSeq | 마지막으로 부여한 요구사항(R) 번호 카운터. 기본 0 |
| questionSeq | 마지막으로 부여한 미결 질문(Q) 번호 카운터. 기본 0 |

## 변경: SpecItem

| 필드 | 설명 |
|---|---|
| number | 종류별 안정 번호(표시 `D-{number}` 또는 `R-{number}`). 같은 `key`의 모든 버전 행에 같은 값을 복사한다 |

- 새 `key`가 처음 저장될 때 feature 락 안에서 해당 종류 카운터를 1 올려 번호를 부여한다
- 되돌리기·AI 갱신이 기존 key의 행을 복사할 때 번호는 그대로 유지한다
- 기존 key의 `kind`는 바뀔 수 없다 (출력 검증에서 거부)
- 유니크: `(versionId, kind, number)`

## 변경: OpenQuestion

| 필드 | 설명 |
|---|---|
| number | 안정 번호(표시 `Q-{number}`). 같은 `key`의 모든 버전 행에 같은 값을 복사한다 |

- 새 `key`가 처음 저장될 때 feature 락 안에서 `Spec.questionSeq`를 1 올려 부여하고, 되돌리기·새 버전에서 같은 key는 번호를 유지한다
- 유니크: `(versionId, number)`

## 변경: SpecItemSource, OpenQuestionSource

| 필드 | 설명 |
|---|---|
| quoteStart | 인용 발췌의 시작 위치(입력 원문 문자 오프셋). 발췌 없으면 null |
| quoteEnd | 인용 발췌의 끝 위치(제외). 발췌 없으면 null |

- `quoteStart`와 `quoteEnd`는 둘 다 null이거나 둘 다 값이 있어야 하며, `0 ≤ quoteStart < quoteEnd ≤ 원문 길이`, `quoteEnd − quoteStart ≤ 500`
- 화면 표시 문장은 `원문.slice(quoteStart, quoteEnd)`이다. 문장 텍스트를 따로 저장하지 않는다
- 이 feature 이전의 연결은 모두 null

## 기존 데이터 번호 부여 (마이그레이션)

1. `Input.boardId`를 feature → project → board에서 채운다
2. 보드별로 `submittedAt, id` 순서로 `number`를 1부터 부여하고 `Board.inputSeq`를 최댓값으로 설정한다
3. spec별로 항목은 `(key, kind)` 쌍의 최초 등장(최소 버전 번호, 그 안의 position) 순서로 종류별 번호를 부여하고, 같은 `(key, kind)`의 모든 버전 행에 같은 번호를 쓰고, `Spec.decisionSeq`·`requirementSeq`를 최댓값으로 설정한다. 질문은 key의 최초 등장 순서로 번호를 부여하고 `Spec.questionSeq`를 최댓값으로 설정한다. (002에는 기존 key의 종류 변경을 막는 규칙이 없었으므로 한 key가 종류를 바꾼 과거 데이터가 있으면 두 종류에 각각 번호가 붙는다. 그 수는 점검 스크립트가 보고하며, 이 feature 이후로는 종류 변경이 거부된다)
4. 이후 NOT NULL·유니크 제약을 건다
5. 기존 입력·항목·출처·버전의 내용은 변경하지 않는다

## 조회 전용 계산 (저장하지 않음)

### 항목의 변경 버전 표시
- `firstVersion(key)`: key가 처음 나타난 버전 번호
- `lastChangedVersion(key)`: 버전을 번호순으로 훑으며, 직전 버전에 key가 없었거나 문구가 직전과 달라진 가장 최근 버전 번호
- 표시: 최신 버전에서 `firstVersion == 최신`이면 "vN에서 추가", `lastChangedVersion == 최신`이고 `firstVersion < 최신`이면 "vN에서 변경", 항상 "vN부터"(firstVersion)

### 질문의 해소 버전
- `resolvedInVersion(key)`: 질문이 처음 RESOLVED 상태가 된 버전 번호. 열린 질문은 null. 표시는 "vN에서 해소"

### spec 상태 판정(`deriveSpecStatus`)
입력: 확정 여부, 활성 작업 존재, 최신 작업이 FAILED인지, 반영 대기 입력 수, 버전 존재 여부. 출력: `NONE | IDLE | UPDATING | FAILED | FINALIZED`. 002의 `getSpec` 규칙과 같고 홈 요약이 재사용한다.

### 되돌리기 영향(`revert-preview`)
- `removedItems`: 최신 버전에 있고 대상 버전에 없는 항목 key 수와 라벨 목록
- `reopenedQuestions`: 최신 버전에서 RESOLVED인데 대상 버전에서 OPEN이거나 없는 질문 수와 목록
- 같은 계산을 `revertSpec`이 재사용하고, `expected`와 다르면 409 `PREVIEW_CHANGED`

### 입력 필터와 개수
가시성 규칙(001, FR-021): 관리자는 전체, 그 외는 승인·반려 입력과 본인의 대기 입력.

| 필터 | 조건 (가시성 규칙 적용 후) |
|---|---|
| all | 전체 |
| mine-pending | `status = PENDING AND submittedBy = 나` |
| reflect-pending | `status = APPROVED AND consumedAt IS NULL` |
| rejected | `status = REJECTED` |

### 홈 요약
보드(내 역할) → 프로젝트 → feature 목록, feature마다 `{specStatus, latestVersionNumber, latestVersionAt, pendingReflectCount}`. 관리자 보드에는 보드 단위 대기 입력 수.

## 검증 규칙 → 요구사항 매핑

| 규칙 | 요구사항 |
|---|---|
| `(boardId, number)` 유니크, 원자적 카운터 | FR-010, SC-009 |
| `(versionId, kind, number)` 유니크, key 간 번호 복사, kind 변경 거부 | FR-011, SC-009 |
| backfill 후 중복·누락 0, 기존 내용 불변 | FR-013, SC-009 |
| 발췌는 원문에 존재하고 500자 이하일 때만 저장 | FR-032, SC-005 |
| 발췌가 없어도 항목·출처 연결은 유지 | FR-032, FR-033 |
| 필터·개수는 가시성 규칙 안에서 계산 | FR-016 |
| 미리보기와 revert 결과는 같은 계산, `expected` 불일치 시 409 | FR-029, FR-030, SC-007 |
| 보드 승인 대기·홈 요약·미리보기 API는 서비스의 `requireRole` 통과 | FR-007, FR-018, FR-021, SC-008 |

## 권한 매트릭스 (추가분, 서버 강제)

| 동작 | ADMIN | MEMBER | VIEWER | 비멤버 |
|---|---|---|---|---|
| 보드 승인 대기 목록·개수 | O | X | X | X |
| 홈 요약 | 본인이 속한 보드만 | 본인이 속한 보드만 | 본인이 속한 보드만 | - |
| 입력 뷰(필터·개수) | O (전체) | O (가시성 규칙) | O (가시성 규칙) | X |
| 되돌리기 미리보기 | O | X | X | X |
