import { Icon, type IconName } from "@/components/ui/Icon";

const ICONS: Record<"info" | "wait" | "error" | "neutral", IconName> = {
  info: "refresh",
  wait: "clock",
  error: "warn",
  neutral: "doc",
};

export function Banner({
  tone = "neutral",
  title,
  children,
  actions,
  role,
}: {
  tone?: "info" | "wait" | "error" | "neutral";
  title?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div className={`banner ${tone === "neutral" ? "" : `banner--${tone}`}`.trim()} role={role}>
      <Icon name={ICONS[tone]} size={18} />
      <div className="stack" style={{ gap: 4, flex: 1 }}>
        {title && <div className="banner__title">{title}</div>}
        {children && <div className="small">{children}</div>}
      </div>
      {actions}
    </div>
  );
}
