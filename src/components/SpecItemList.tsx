import type { ItemView } from "@/server/services/spec-view";
import { SourceList } from "@/components/SourceList";

export function SpecItemList({ items }: { items: ItemView[] }) {
  if (items.length === 0) return <p className="meta">아직 항목이 없습니다.</p>;
  return (
    <section aria-label="spec 항목">
      {items.map((item) => (
        <article key={item.key} className="card" data-key={item.key}>
          <span className="badge">{item.kind === "DECISION" ? "결정" : "요구사항"}</span>
          <pre>{item.text}</pre>
          <SourceList sources={item.sources} />
        </article>
      ))}
    </section>
  );
}
