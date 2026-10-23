import Link from "next/link";
import { DiffRow, UnchangedRow } from "@/components/history/DiffRow";
import { VersionList } from "@/components/history/VersionList";
import { Banner } from "@/components/ui/Banner";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShort } from "@/lib/format";
import { pageContext } from "@/server/auth/page-context";
import { db } from "@/server/db/client";
import { diff, listVersions } from "@/server/services/spec";

export const metadata = { title: "버전 이력" };

const INITIAL_VISIBLE = 4;
const num = (v: string | undefined) => (v && Number.isInteger(Number(v)) && Number(v) >= 1 ? Number(v) : null);

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
  searchParams: Promise<{ a?: string; b?: string; all?: string; versions?: string }>;
}) {
  const { boardId, featureId } = await params;
  const q = await searchParams;
  const { user, role } = await pageContext(boardId);
  const versions = await listVersions(user, boardId, featureId);
  const spec = await db.spec.findUnique({ where: { featureId }, select: { finalizedAt: true, finalizedByName: true } });
  const finalized = Boolean(spec?.finalizedAt);
  const base = `/boards/${boardId}/features/${featureId}`;

  if (versions.length === 0) {
    return (
      <EmptyState icon="doc" title="아직 버전이 없습니다">
        승인된 입력으로 첫 spec이 만들어지면 여기에 이력이 쌓입니다.
      </EmptyState>
    );
  }

  // 기본 선택: 최신 두 버전 (이전=A, 이후=B)
  const numbers = new Set(versions.map((v) => v.number));
  let a = num(q.a);
  let b = num(q.b);
  if (a !== null && !numbers.has(a)) a = null;
  if (b !== null && !numbers.has(b)) b = null;
  if (a === null && b === null && versions.length >= 2) {
    a = versions[1].number;
    b = versions[0].number;
  }
  const showAll = q.versions === "all";
  const visible = showAll ? versions : versions.slice(0, INITIAL_VISIBLE);

  const result = a !== null && b !== null && a !== b ? await diff(user, boardId, featureId, a, b) : null;
  const showUnchanged = q.all === "1";
  const keep = new URLSearchParams({ ...(a ? { a: String(a) } : {}), ...(b ? { b: String(b) } : {}), ...(showAll ? { versions: "all" } : {}) });
  const toggleHref = `${base}/spec/history?${new URLSearchParams({ ...Object.fromEntries(keep), ...(showUnchanged ? {} : { all: "1" }) })}`;
  const rows = result ? [...result.items, ...result.questions] : [];

  return (
    <div className="stack" style={{ gap: 16 }}>
      {finalized && (
        <Banner tone="neutral" title="확정된 동안에는 되돌릴 수 없습니다">
          {spec?.finalizedByName}님이 확정했습니다. 되돌리려면{" "}
          <Link href={`${base}/spec`}>Spec 화면에서 확정을 해제</Link>한 뒤 다시 시도하세요.
        </Banner>
      )}
      <div className="history">
        <VersionList
          versions={visible}
          selected={[a, b]}
          boardId={boardId}
          featureId={featureId}
          canRevert={role === "ADMIN"}
          finalized={finalized}
          hiddenCount={versions.length - visible.length}
        />
        <section className="stack" aria-label="비교 결과">
          {!result ? (
            <EmptyState icon="compare" title="비교할 두 버전을 선택하세요">
              왼쪽 목록에서 서로 다른 두 버전을 체크하면 추가·삭제·변경이 여기에 나타납니다.
            </EmptyState>
          ) : (
            <>
              <Card style={{ padding: "12px 20px" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row" style={{ gap: 12 }}>
                    <h2 className="mono">v{result.from} → v{result.to} 비교</h2>
                    <Badge tone="ok" icon="check">+ 추가 {result.summary.added}</Badge>
                    <Badge tone="no" icon="x">− 삭제 {result.summary.removed}</Badge>
                    <Badge tone="wait" icon="refresh">~ 변경 {result.summary.changed}</Badge>
                    <Badge>동일 {result.summary.unchanged}</Badge>
                  </div>
                  <Link href={toggleHref} aria-pressed={showUnchanged} className="small">
                    {showUnchanged ? "변경 없는 항목 숨기기" : "변경 없는 항목도 보기"}
                  </Link>
                </div>
              </Card>
              {rows.length === 0 && (
                <EmptyState icon="check" title="차이가 없습니다">
                  두 버전의 내용이 같습니다.
                </EmptyState>
              )}
              {rows.map((c) => (
                <DiffRow key={`${c.scope}-${c.key}`} change={c} />
              ))}
              {showUnchanged && result.unchanged.map((u) => <UnchangedRow key={`${u.scope}-${u.key}`} row={u} />)}
              <p className="meta">v{result.from} · {formatShort(versions.find((v) => v.number === result.from)!.createdAt)} → v{result.to} · {formatShort(versions.find((v) => v.number === result.to)!.createdAt)}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
