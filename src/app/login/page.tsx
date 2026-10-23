import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/server/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <main>
      <h1>Specboard 로그인</h1>
      <form action={login} className="card">
        <label>
          이메일
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          비밀번호
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className="error">이메일 또는 비밀번호가 올바르지 않습니다.</p>}
        <button type="submit">로그인</button>
      </form>
    </main>
  );
}
