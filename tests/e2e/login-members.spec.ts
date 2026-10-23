import { expect, test } from "@playwright/test";
import { clickUntil, login } from "./helpers";

test("로그인 실패: 안내가 폼 위에 보이고 이메일 값이 유지된다 (시나리오 23)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("회의에서 정한 것을, 근거와 함께 남깁니다.")).toBeVisible();
  await expect(page.getByText("계정은 보드 관리자가 추가합니다.")).toBeVisible();
  await page.getByLabel("이메일").fill("admin@specboard.local");
  await page.getByLabel("비밀번호").fill("틀린-비밀번호");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.locator(".banner--error")).toContainText("이메일 또는 비밀번호가 올바르지 않습니다");
  await expect(page.getByLabel("이메일")).toHaveValue("admin@specboard.local");
});

test("멤버 관리: (나) 표시, 역할 즉시 저장, 마지막 관리자 강등 오류 (시나리오 23)", async ({ page }) => {
  await login(page, "admin");
  await page.getByRole("region", { name: "Specboard 팀" }).getByRole("link", { name: "멤버 관리" }).click();
  await page.waitForURL(/\/members$/);
  await expect(page.getByRole("row", { name: /관리자.*\(나\)/ })).toBeVisible();

  // 역할 즉시 저장: 열람자 → 멤버 → 열람자
  const viewerSelect = page.getByLabel("열람자 역할");
  await clickUntil(
    async () => { await viewerSelect.selectOption("MEMBER", { timeout: 2000 }); },
    async () => { await page.reload(); await expect(page.getByLabel("열람자 역할")).toHaveValue("MEMBER", { timeout: 2000 }); },
  );
  await page.getByLabel("열람자 역할").selectOption("VIEWER");
  await page.reload();
  await expect(page.getByLabel("열람자 역할")).toHaveValue("VIEWER");

  // 유일한 관리자 강등: 그 행에 이유와 역할 유지 안내
  await page.getByLabel("관리자 역할").selectOption("MEMBER");
  await expect(page.getByRole("alert").filter({ hasText: "마지막 관리자" })).toContainText("역할은 ‘관리자’로 유지됩니다");
  await expect(page.getByLabel("관리자 역할")).toHaveValue("ADMIN");
});

test("멤버가 멤버 관리 주소로 들어가면 403, 없는 보드는 404 (시나리오 21)", async ({ page }) => {
  await login(page, "member");
  await page.getByRole("link", { name: "입력 제출과 승인" }).click();
  await page.waitForURL(/\/features\/[^/]+\/(spec|inputs)/);
  const boardBase = page.url().replace(/\/features\/.*$/, "");
  await page.goto(`${boardBase}/members`);
  await expect(page.getByText("이 화면을 볼 권한이 없습니다")).toBeVisible();
  await expect(page.getByText("지금 내 역할은 멤버입니다")).toBeVisible();

  await page.goto("/boards/no-such-board/members");
  await expect(page.getByText("찾을 수 없습니다")).toBeVisible();
  await page.goto(`${boardBase}/features/no-such-feature/spec`);
  await expect(page.getByText("찾을 수 없습니다")).toBeVisible();
});
