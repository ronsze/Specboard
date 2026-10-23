import Link from "next/link";
import { VersionKindBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatShort } from "@/lib/format";
import type { VersionSummary } from "@/server/services/spec-view";

export function RecentVersions({ versions, historyHref }: { versions: VersionSummary[]; historyHref: string }) {
  if (versions.length === 0) return null;
  return (
    <Card aria-labelledby="recent-versions-title">
      <h2 id="recent-versions-title">최근 버전</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0" }} className="stack">
        {versions.map((v) => (
          <li key={v.number} className="row" style={{ justifyContent: "space-between" }}>
            <span className="row">
              <strong className="mono">v{v.number}</strong>
              <VersionKindBadge kind={v.kind} />
              {v.kind === "REVERT" && <span className="meta">v{v.revertedFromNumber}로 되돌림</span>}
            </span>
            <span className="mono meta">{formatShort(v.createdAt)}</span>
          </li>
        ))}
      </ul>
      <Link href={historyHref}>전체 이력과 비교</Link>
    </Card>
  );
}
