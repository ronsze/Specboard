import Link from "next/link";

export type TabItem = { href: string; label: string; count?: number | null; active: boolean };

export function Tabs({ items, label = "feature 화면" }: { items: TabItem[]; label?: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.active ? "page" : undefined}>
          {t.label}
          {typeof t.count === "number" && <span className="mono">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
