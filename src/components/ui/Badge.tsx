import { Icon, type IconName } from "@/components/ui/Icon";

export type Tone = "neutral" | "ok" | "wait" | "no" | "auto" | "src" | "ai" | "q" | "outline" | "dark";

/** 모든 배지는 아이콘(또는 기호)과 글자를 함께 가진다. 색은 보조 수단이다. */
export function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: Tone;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge ${tone === "neutral" ? "" : `badge--${tone}`} ${className}`.trim()}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

const INPUT_STATUS = {
  PENDING: { tone: "wait", icon: "clock", label: "대기" },
  APPROVED: { tone: "ok", icon: "check", label: "승인" },
  REJECTED: { tone: "no", icon: "x", label: "반려" },
} as const;

export function InputStatusBadge({ status, auto }: { status: keyof typeof INPUT_STATUS; auto?: boolean }) {
  if (auto) return <Badge tone="auto" icon="check-double">자동 승인</Badge>;
  const s = INPUT_STATUS[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

const SPEC_STATUS = {
  NONE: { tone: "neutral", icon: "doc", label: "spec 없음" },
  IDLE: { tone: "ok", icon: "check", label: "최신" },
  UPDATING: { tone: "src", icon: "refresh", label: "갱신 중" },
  FAILED: { tone: "no", icon: "warn", label: "갱신 실패" },
  FINALIZED: { tone: "dark", icon: "lock", label: "확정됨" },
} as const;

export function SpecStatusBadge({ status }: { status: keyof typeof SPEC_STATUS }) {
  const s = SPEC_STATUS[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

export function ItemKindBadge({ kind }: { kind: "DECISION" | "REQUIREMENT" }) {
  return kind === "DECISION" ? (
    <Badge tone="outline" icon="diamond">결정</Badge>
  ) : (
    <Badge tone="outline" icon="square">요구사항</Badge>
  );
}

export function QuestionStatusBadge({ status }: { status: "OPEN" | "RESOLVED" }) {
  return status === "OPEN" ? (
    <Badge tone="q" icon="circle">열림</Badge>
  ) : (
    <Badge tone="ok" icon="check">해소</Badge>
  );
}

const INPUT_KIND = { MEETING_NOTE: "회의록", IDEA: "아이디어", OPINION: "의견" } as const;
export const inputKindLabel = (kind: keyof typeof INPUT_KIND) => INPUT_KIND[kind];

export function InputKindBadge({ kind }: { kind: keyof typeof INPUT_KIND }) {
  return <Badge>{INPUT_KIND[kind]}</Badge>;
}

const ROLE = { ADMIN: "관리자", MEMBER: "멤버", VIEWER: "열람자" } as const;
export const roleLabel = (role: keyof typeof ROLE) => ROLE[role];

export function RoleBadge({ role }: { role: keyof typeof ROLE }) {
  return <Badge tone="outline" icon="person">내 역할 · {ROLE[role]}</Badge>;
}

export function VersionKindBadge({ kind }: { kind: "AI_UPDATE" | "REVERT" }) {
  return kind === "AI_UPDATE" ? (
    <Badge tone="ai" icon="lines">AI 갱신</Badge>
  ) : (
    <Badge tone="outline" icon="undo">되돌림</Badge>
  );
}
