import { SourceToggle } from "@/components/spec/SourceToggle";
import { ItemKindBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { ItemView } from "@/server/services/spec-view";

function provenance(item: ItemView) {
  if (item.change === "ADDED") return `v${item.lastChangedVersion}에서 추가`;
  if (item.change === "CHANGED") return `v${item.firstVersion}부터 · v${item.lastChangedVersion}에서 변경`;
  return `v${item.firstVersion}부터`;
}

/** spec 항목 한 건: 종류·번호, AI가 정리한 문장, 출처 칩. */
export function ItemCard({ item, inputsBase }: { item: ItemView; inputsBase: string }) {
  return (
    <article className="card item-card" id={item.label} data-key={item.key} aria-label={`${item.label} ${item.text}`}>
      <div className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
        <ItemKindBadge kind={item.kind} />
        <span className="id">{item.label}</span>
      </div>
      <p className="item-card__text">{item.text}</p>
      <div className="item-card__foot">
        <span className="small item-card__meta" style={{ color: "var(--ai)", fontWeight: 600 }}>
          <Icon name="lines" size={13} /> AI 정리 · {provenance(item)}
        </span>
        <SourceToggle sources={item.sources} inputsBase={inputsBase} />
      </div>
    </article>
  );
}
