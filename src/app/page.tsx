import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { RoleBadge, SpecStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDay } from "@/lib/format";
import { auth } from "@/server/auth/session";
import { getHome, type HomeFeature } from "@/server/services/home";

export const metadata = { title: "내 보드" };

function FeatureSummary({ f }: { f: HomeFeature }) {
  if (f.specStatus === "UPDATING") {
    return <span className="mono meta">{f.latestVersion ? `v${f.latestVersion} → v${f.updatingToVersion}` : `첫 spec 생성 중`}</span>;
  }
  if (f.specStatus === "NONE") return <span className="meta">승인된 입력 없음</span>;
  return (
    <span className="row" style={{ gap: 16 }}>
      {f.latestVersion && (
        <span className="mono meta">
          v{f.latestVersion} · {f.latestVersionAt && formatDay(f.latestVersionAt)}
        </span>
      )}
      {f.pendingReflectCount > 0 && <span className="small">반영 대기 입력 {f.pendingReflectCount}</span>}
    </span>
  );
}

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, displayName: session.user.name ?? session.user.email ?? "" };
  const home = await getHome(user);

  return (
    <>
      <AppHeader userName={user.displayName} />
      <main className="container container--narrow stack" style={{ gap: 20 }}>
        <h1>내 보드</h1>
        {home.boards.length === 0 && (
          <EmptyState icon="doc" title="참여 중인 보드가 없습니다">
            계정은 보드 관리자가 추가합니다. 관리자에게 보드 초대를 요청하세요.
          </EmptyState>
        )}
        {home.boards.map((board) => (
          <section key={board.id} id={`board-${board.id}`} className="card" style={{ padding: 0, overflow: "hidden" }} aria-label={board.name}>
            <div className="row" style={{ padding: "16px 24px", justifyContent: "space-between" }}>
              <div className="row" style={{ gap: 12 }}>
                <h2 style={{ fontSize: 20 }}>{board.name}</h2>
                <RoleBadge role={board.role} />
              </div>
              {board.role === "ADMIN" && (
                <div className="row" style={{ gap: 16 }}>
                  <Link href={`/boards/${board.id}/pending`}>
                    승인 대기 {board.pendingApprovalCount ? board.pendingApprovalCount : ""}
                  </Link>
                  <Link href={`/boards/${board.id}/members`}>멤버 관리</Link>
                </div>
              )}
            </div>
            {board.projects.map((project) => (
              <div key={project.id} id={`project-${project.id}`}>
                <div className="small" style={{ padding: "8px 24px", background: "var(--mute-bg)", fontWeight: 600, color: "var(--ink-3)" }}>
                  {project.name}
                </div>
                {project.features.length === 0 && <p className="meta" style={{ padding: "12px 24px" }}>feature가 없습니다.</p>}
                {project.features.map((f) => (
                  <div
                    key={f.id}
                    className="row"
                    style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", justifyContent: "space-between" }}
                  >
                    <span className="row" style={{ gap: 12 }}>
                      <Link href={`/boards/${board.id}/features/${f.id}/spec`} style={{ fontWeight: 600 }}>
                        {f.name}
                      </Link>
                      <SpecStatusBadge status={f.specStatus} />
                    </span>
                    <FeatureSummary f={f} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
