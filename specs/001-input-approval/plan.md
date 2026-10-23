# Implementation Plan: 입력 제출과 관리자 승인

**Branch**: `001-input-approval` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-input-approval/spec.md`

## Summary

멤버가 feature에 입력(회의록/아이디어/의견)을 제출하면 "대기"가 되고, 관리자가 승인 또는 사유와 함께 반려한다. 관리자가 낸 입력은 자동 승인된다. 보드 단위 역할(관리자/멤버/열람자)을 서버에서 강제한다. 접근 방식: Next.js 풀스택 단일 프로젝트에서 서버 계층(서비스)이 권한과 상태 전이를 전담하고, PostgreSQL 조건부 갱신으로 동시 처리 충돌을 막는다.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS 이상

**Primary Dependencies**: Next.js 15 (App Router, React 19), Prisma, Auth.js (이메일·비밀번호 Credentials), Zod

**Storage**: PostgreSQL 16 (로컬 개발은 Docker)

**Testing**: Vitest (단위·통합, 실제 PostgreSQL 대상), Playwright (핵심 흐름 E2E)

**Target Platform**: 웹 브라우저(데스크톱 우선), Node 서버

**Project Type**: web-service (풀스택 단일 프로젝트)

**Performance Goals**: 입력 목록·제출·승인 응답이 일반 조건에서 사용자가 즉시 반응으로 느낄 수준(서버 처리 p95 300ms 이내)

**Constraints**: 권한 검사는 서버 측 필수(constitution VI). 입력 본문 최대 50,000자. 승인·반려는 한 번만 성공

**Scale/Scope**: 단일 팀(보드 1개 우선), 보드당 멤버 수십 명, feature당 입력 수백 건, 화면 약 5개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 출처 | 통과 | Input이 제출자·시각·종류를 기록. 이후 spec 연결의 출처 단위로 쓰임 |
| II. AI 임의 생성 금지 | 해당 없음 | 이 feature에 AI 없음 |
| III. 승인된 입력만 반영 | 통과 | 상태 PENDING/APPROVED/REJECTED, "사용 가능 입력"은 APPROVED만 조회하는 단일 질의로 제공 |
| IV. 버전·이력 | 통과(범위 한정) | 입력은 불변, 상태 전이는 한 번만. spec 버전은 별도 feature |
| V. 충돌 경고 | 해당 없음 | 별도 feature. 승인 화면에 확장 지점만 남김 |
| VI. 서버 권한 | 통과 | 모든 서비스 함수가 역할 검사를 거치고 UI는 보조 |
| VII. spec-kit 마크다운 | 해당 없음 | 내보내기는 별도 feature |

Phase 1 설계 후 재평가: 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/001-input-approval/
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
└── schema.prisma
src/
├── app/                     # 화면과 Route Handler (얇게 유지)
│   ├── (auth)/login/
│   ├── boards/[boardId]/
│   │   ├── members/
│   │   └── features/[featureId]/inputs/
│   └── api/boards/[boardId]/...
├── server/
│   ├── auth/                # 세션 해석
│   ├── authz/               # 역할 검사 (단일 진입점)
│   ├── services/            # inputs, members 비즈니스 규칙
│   └── db/
└── lib/                     # 검증 스키마(Zod), 공용 타입
tests/
├── unit/
├── integration/             # 실제 DB로 서비스 계층 검증
└── e2e/
```

**Structure Decision**: 단일 Next.js 프로젝트. 모든 비즈니스 규칙(권한, 상태 전이, 마지막 관리자 보호)은 `src/server/services`에 두고 Route Handler와 화면은 이를 호출만 한다. 프론트·백엔드 분리는 현재 규모에서 이득이 없어 채택하지 않는다.

## Complexity Tracking

위반 없음.
