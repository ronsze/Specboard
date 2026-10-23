import { Icon, type IconName } from "@/components/ui/Icon";

export function EmptyState({
  icon = "doc",
  code,
  title,
  children,
  actions,
}: {
  icon?: IconName;
  /** 403, 404 같은 상태 코드 표시 */
  code?: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {code ? <div className="empty__code" aria-hidden="true">{code}</div> : <Icon name={icon} size={32} />}
      <h2>{title}</h2>
      {children && <p className="meta" style={{ maxWidth: 440 }}>{children}</p>}
      {actions}
    </div>
  );
}
