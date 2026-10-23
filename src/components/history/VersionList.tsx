"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RevertDialog } from "@/components/history/RevertDialog";
import { VersionKindBadge, Badge } from "@/components/ui/Badge";
import { formatFull } from "@/lib/format";
import type { VersionSummary } from "@/server/services/spec-view";

/**
 * 버전 카드 목록과 A/B 비교 선택. 체크한 두 버전(이전=A, 이후=B)이 주소(?a=&b=)에 반영된다.
 * 같은 버전을 둘 다 고를 수 없고, 세 번째를 체크하면 먼저 고른 것이 해제된다.
 */
export function VersionList({
  versions,
  selected,
  boardId,
  featureId,
  canRevert,
  finalized,
  hiddenCount,
}: {
  versions: VersionSummary[];
  selected: [number | null, number | null];
  boardId: string;
  featureId: string;
  canRevert: boolean;
  finalized: boolean;
  hiddenCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputsBase = `/boards/${boardId}/features/${featureId}/inputs`;
  const [a, b] = selected;

  function toggle(n: number) {
    const current = [a, b].filter((v): v is number => v !== null);
    const next = current.includes(n) ? current.filter((v) => v !== n) : [...current.slice(-1), n];
    const sorted = [...next].sort((x, y) => x - y);
    const q = new URLSearchParams(params.toString());
    q.delete("a");
    q.delete("b");
    if (sorted[0]) q.set("a", String(sorted[0]));
    if (sorted[1]) q.set("b", String(sorted[1]));
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  }

  return (
    <section className="stack" aria-label="버전 목록">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>
          버전 <span className="meta" style={{ fontWeight: 400 }}>최신순 · {versions.length + hiddenCount}개</span>
        </h2>
        <span className="meta">두 버전을 골라 비교</span>
      </div>
      {versions.map((v) => {
        const slot = v.number === a ? "A" : v.number === b ? "B" : null;
        return (
          <article
            key={v.number}
            className={`card stack ${slot ? "card--selected" : ""}`}
            data-version={v.number}
            style={{ gap: 8, padding: 16 }}
            aria-label={`v${v.number}`}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="row" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={slot !== null}
                  onChange={() => toggle(v.number)}
                  aria-label={`v${v.number} 비교 선택`}
                />
                <strong className="mono" style={{ fontSize: 16 }}>v{v.number}</strong>
                <VersionKindBadge kind={v.kind} />
                {v.isCurrent && <Badge tone="ok" icon="check">현재</Badge>}
              </label>
              {slot && <span className="badge badge--dark" aria-label={`비교 ${slot}`}>{slot}</span>}
            </div>
            <p className="meta mono">{formatFull(v.createdAt)}</p>
            {v.kind === "REVERT" ? (
              <p className="small">
                <strong>버전 {v.revertedFromNumber}로 되돌림</strong> · 실행 {v.createdByName}
              </p>
            ) : (
              v.inputs.length > 0 && (
                <p className="small">
                  근거 입력{" "}
                  {v.inputs.map((i, idx) => (
                    <span key={i.id}>
                      {idx > 0 && " · "}
                      <Link href={`${inputsBase}#${i.label}`} className="mono">{i.label}</Link>
                    </span>
                  ))}
                </p>
              )
            )}
            {canRevert && !v.isCurrent && !finalized && (
              <div>
                <RevertDialog boardId={boardId} featureId={featureId} version={v.number} />
              </div>
            )}
          </article>
        );
      })}
      {hiddenCount > 0 && (
        <p>
          <Link href={`${pathname}?${new URLSearchParams({ ...(a ? { a: String(a) } : {}), ...(b ? { b: String(b) } : {}), versions: "all" })}`} className="btn btn--text">
            이전 버전 {hiddenCount}개 더 보기
          </Link>
        </p>
      )}
    </section>
  );
}
