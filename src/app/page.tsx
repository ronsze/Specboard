import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/server/auth/session";
import { db } from "@/server/db/client";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { board: { include: { projects: { include: { features: true } } } } },
  });

  return (
    <main>
      <nav>
        <strong>Specboard</strong>
        <span className="spacer" />
        <span className="meta">{session.user.name}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit">로그아웃</button>
        </form>
      </nav>
      {memberships.length === 0 && <p>참여 중인 보드가 없습니다.</p>}
      {memberships.map((m) => (
        <section key={m.boardId} className="card">
          <h2>
            {m.board.name} <span className="badge">{m.role}</span>
          </h2>
          {m.role === "ADMIN" && <Link href={`/boards/${m.boardId}/members`}>멤버 관리</Link>}
          {m.board.projects.map((p) => (
            <div key={p.id}>
              <strong>{p.name}</strong>
              <ul>
                {p.features.map((f) => (
                  <li key={f.id}>
                    <Link href={`/boards/${m.boardId}/features/${f.id}/inputs`}>{f.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
