# Implementation Plan: 디자인 시안 적용

**Branch**: `003-design-system-ui` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-design-system-ui/spec.md`

## Summary

시안(`docs/Specboard-selection.pdf`)의 토큰과 공용 컴포넌트를 CSS 변수와 서버·클라이언트 컴포넌트로 도입하고 모든 화면을 다시 만든다. 시안이 요구하는 데이터(입력 번호 IN-n, 항목 번호 D-n/R-n, 변경 버전 표시, 보드 단위 승인 대기, 홈 요약, 입력 필터와 개수, 되돌리기 영향 미리보기, 비교 확장, 인용 발췌)는 서비스 계층에 추가하고, 서버 컴포넌트가 서비스를 직접 호출하는 것과 별개로 같은 서비스를 JSON API로도 노출한다. 새 UI 라이브러리는 도입하지 않는다(네이티브 `<dialog>`, 인라인 SVG, `next/font`).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS 이상 (001·002와 동일)

**Primary Dependencies**: Next.js 15, Prisma, Auth.js, Zod, `@anthropic-ai/sdk` (기존). 신규 런타임 UI 라이브러리 없음. 테스트용으로만 `@axe-core/playwright` 추가

**Storage**: PostgreSQL 16. 마이그레이션으로 번호·인용 발췌 컬럼 추가와 기존 데이터 번호 부여(backfill)

**Testing**: Vitest(단위·통합, 실제 PostgreSQL), Playwright(E2E, 키보드 조작, 라이트·다크, axe 접근성 점검)

**Target Platform**: 웹 브라우저(데스크톱 우선). 반응형은 spec 보기와 입력 제출 두 화면만 휴대폰 너비 지원. 이후 React Native 앱이 같은 JSON API를 쓸 수 있는 구조

**Project Type**: web-service (001·002의 단일 Next.js 프로젝트)

**Performance Goals**: 새 조회 API(홈 요약, 보드 승인 대기, 입력 뷰, 미리보기)의 서버 처리 p95 300ms 이내. N+1 조회 금지(집계 쿼리로 묶음)

**Constraints**: 권한 검사는 서버 측(원칙 VI). 새 JSON API는 기존 `requireRole` 진입점을 거친다. 일반 글자 대비 4.5:1 이상(라이트·다크). 모든 상태는 색 + 아이콘/기호 + 글자. 키보드만으로 모든 동작. 인용 발췌 최대 500자, 원문에 실제 존재하는 것만 저장

**Scale/Scope**: 단일 팀, 보드당 입력 수천 건, feature당 버전 수십~수백, 화면 7종 + 상태 화면

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 출처 | 통과 | 항목의 출처 연결은 그대로 필수. 인용 발췌는 선택 메타데이터이며 서버가 원문 존재를 확인한 것만 저장 |
| II. AI 임의 생성 금지 | 통과 | 발췌가 원문에 없으면 버림(지어낸 인용 표시 0건). 발췌 실패로 항목을 거부하지 않음 |
| III. 승인된 입력만 | 통과 | 영향 없음. 승인 대기 화면은 PENDING만 다루고 재료 조회 규칙은 그대로 |
| IV. 버전·이력·롤백 | 통과 | 항목 번호는 되돌리기·새 버전에서도 유지. 되돌리기 영향 미리보기는 실제 결과와 같은 계산을 공유 |
| V. 충돌 경고 | 해당 없음 | 시안의 "예정" 표시는 만들지 않음. 승인 대기 카드에 확장 자리만 둠 |
| VI. 서버 권한 | 통과 | 새 API 전부 서비스 계층 `requireRole`. 화면에서 숨겨도 서버가 다시 검사. 접근 불가 화면은 403 안내 |
| VII. spec-kit 마크다운 | 해당 없음 | 항목 번호(D-n/R-n)는 이후 내보내기에서 그대로 쓸 수 있는 안정 식별자 |

Phase 1 설계 후 재평가: 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/003-design-system-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design-parity.md     # 시안 대조 점검표 (SC-011)
├── contracts/
│   └── openapi.yaml     # 신규·변경 API (001·002 계약에 대한 증분)
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
└── migrations/<ts>_numbering_and_quotes/   # 컬럼 추가 + backfill
src/
├── styles/
│   ├── tokens.css                 # 색·글자·간격·모서리 변수, 다크 오버라이드
│   ├── base.css                   # 리셋, 타이포, 포커스 링
│   └── components.css             # 배지, 카드, 버튼, 폼, 다이얼로그, 비교 행 등
├── components/
│   ├── ui/                        # Badge, Icon(인라인 SVG), Button, Card, Dialog(<dialog>), EmptyState, Tabs
│   ├── layout/                    # AppHeader(역할 배지·승인 대기 배지), Breadcrumb(+전환 메뉴)
│   ├── inputs/                    # InputCard, InputFilters, SubmitInputForm, RejectForm
│   ├── spec/                      # SpecHeaderCard, ItemCard, SourcePanel, QuestionRail, RecentVersions, LockControl, StatusBanner
│   └── history/                   # VersionCard, CompareBar, DiffRow, RevertDialog
├── app/
│   ├── layout.tsx                 # next/font, 전역 CSS
│   ├── page.tsx                   # 홈
│   ├── login/page.tsx
│   ├── not-found.tsx
│   ├── boards/[boardId]/
│   │   ├── layout.tsx             # AppHeader 데이터(역할, 대기 수)
│   │   ├── pending/page.tsx       # 보드 단위 승인 대기
│   │   ├── members/page.tsx
│   │   └── features/[featureId]/{layout.tsx, inputs/page.tsx, spec/page.tsx, spec/history/page.tsx}
│   └── api/
│       ├── home/route.ts
│       └── boards/[boardId]/{pending/route.ts, pending/count/route.ts,
│           features/[featureId]/inputs/view/route.ts, features/[featureId]/spec/revert-preview/route.ts}
├── server/services/
│   ├── numbering.ts               # 입력·항목 번호 할당과 표시 라벨
│   ├── home.ts                    # 홈 요약(집계 쿼리)
│   ├── board-pending.ts           # 보드 단위 승인 대기와 개수
│   ├── spec-status.ts             # deriveSpecStatus (getSpec·홈 공용)
│   ├── spec-provenance.ts         # 항목의 처음 생긴·마지막 변경 버전 계산
│   ├── revert-preview.ts          # 영향 계산 (revertSpec과 공유)
│   └── quotes.ts                  # 발췌 검증·위치 계산(공백 정규화)
└── lib/
    ├── word-diff.ts               # 단어 단위 diff (화면·API 공용)
    └── labels.ts                  # IN-n, D-n, R-n 포맷
tests/
├── unit/        # word-diff, quotes, labels, spec-status, provenance
├── integration/ # numbering(동시성), home, board-pending, input view/filter, revert-preview, quotes 저장, 권한
└── e2e/         # 화면 흐름, 키보드, axe(라이트·다크), 반응형 두 화면
```

**Structure Decision**: 001·002의 단일 프로젝트 구조를 유지한다. 규칙과 집계는 `server/services`에 두고, 화면은 서비스를 직접 호출하며, 같은 서비스를 얇은 Route Handler가 JSON으로 노출한다(원칙: 화면용 데이터도 API로 노출). 스타일은 CSS 변수 토큰 3개 파일로 관리하고 컴포넌트는 클래스 이름 규칙으로 공유한다.

## Complexity Tracking

위반 없음.
