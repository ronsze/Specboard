# Data Model: 입력 제출과 관리자 승인

## 엔티티

### User
- id, email(유니크), passwordHash, displayName, createdAt

### Board
- id, name, createdAt

### Membership
- boardId, userId, role(`ADMIN` | `MEMBER` | `VIEWER`), createdAt
- 유니크: (boardId, userId) → 한 보드에서 한 역할만 (가정)
- 불변식: 보드마다 `ADMIN`이 1명 이상 (FR-020). 역할 변경은 트랜잭션 내 재검사 (멤버 제거는 범위 밖)

### Project, Feature (이 feature에서는 최소 형태)
- Project: id, boardId, name
- Feature: id, projectId, name
- 생성·편집 UI는 범위 밖. 입력을 붙일 대상으로만 존재

### Input
| 필드 | 설명 |
|---|---|
| id | |
| featureId | 대상 feature |
| kind | `MEETING_NOTE` \| `IDEA` \| `OPINION` |
| content | 텍스트, 공백 제외 1자 이상 50,000자 이하 |
| submittedBy | userId (제출자 표시명 스냅샷 `submitterName`도 함께 저장) |
| submittedAt | |
| status | `PENDING` \| `APPROVED` \| `REJECTED` |
| decidedBy, decidedAt | 승인·반려 시 설정 |
| autoApproved | 관리자 제출로 자동 승인되면 true |
| rejectionReason | 반려 시 필수, 공백 제외 1자 이상 |

## 상태 전이

```text
(제출: 멤버)  → PENDING ──승인(관리자)──→ APPROVED
                   └────반려(관리자, 사유 필수)──→ REJECTED
(제출: 관리자) → APPROVED (autoApproved = true)
```

- `APPROVED`, `REJECTED`는 종결 상태. 재처리 불가 (FR-009)
- 전이는 `WHERE status = 'PENDING'` 조건부 갱신으로 수행하고, 영향 행이 0이면 "이미 처리됨" 오류

## 검증 규칙 → 요구사항 매핑

| 규칙 | 요구사항 |
|---|---|
| content 비어 있음 거부 | FR-004 |
| 한 줄 입력 허용 | FR-003 |
| 반려 시 reason 필수 | FR-008 |
| 종결 상태 재처리 거부 | FR-009 |
| 승인 입력만 조회하는 `listApprovedInputs(featureId)` | FR-010 |
| 반려 입력 삭제 API 없음 | FR-011 |
| 마지막 ADMIN 강등 거부 | FR-020 |
| 비관리자는 타인의 PENDING 입력을 볼 수 없음 | FR-021 |

## 권한 매트릭스 (서버 강제)

| 동작 | ADMIN | MEMBER | VIEWER | 비멤버 |
|---|---|---|---|---|
| 입력 목록·열람 (ADMIN: 전체, MEMBER·VIEWER: 승인·반려 입력 + 본인의 대기 입력) | O | O | O | X |
| 입력 제출 | O (자동 승인) | O (대기) | X | X |
| 승인·반려 | O | X | X | X |
| 대기 목록 조회 | O | X | X | X |
| 멤버 역할 관리 | O | X | X | X |
