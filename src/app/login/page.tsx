import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { signIn } from "@/server/auth/session";

export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const emailValue = String(formData.get("email") ?? "");
    try {
      await signIn("credentials", {
        email: emailValue,
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=1&email=${encodeURIComponent(emailValue)}`);
      throw e;
    }
  }

  return (
    <main className="stack" style={{ maxWidth: 380, margin: "0 auto", padding: "96px 16px", alignItems: "stretch", gap: 16 }}>
      <div className="stack" style={{ alignItems: "center", gap: 8, textAlign: "center" }}>
        <Logo size={40} />
        <h1 style={{ fontSize: 24 }}>Specboard</h1>
        <p className="meta">회의에서 정한 것을, 근거와 함께 남깁니다.</p>
      </div>
      <form action={login} className="card stack" aria-label="로그인">
        {error && (
          <Banner tone="error" role="alert" title="이메일 또는 비밀번호가 올바르지 않습니다." />
        )}
        <div className="field">
          <label htmlFor="email" className="field__label">이메일</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="username" defaultValue={email ?? ""} aria-invalid={error ? true : undefined} />
        </div>
        <div className="field">
          <label htmlFor="password" className="field__label">비밀번호</label>
          <input id="password" name="password" type="password" className="input" required autoComplete="current-password" aria-invalid={error ? true : undefined} />
        </div>
        <Button variant="primary" type="submit">로그인</Button>
      </form>
      <p className="meta" style={{ textAlign: "center" }}>계정은 보드 관리자가 추가합니다.</p>
    </main>
  );
}
