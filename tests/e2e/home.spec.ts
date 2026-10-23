import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("홈: 보드 카드의 내 역할, feature 상태·요약, 관리자 전용 링크 (시나리오 16)", async ({ browser }) => {
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(member, "member");

  const adminBoard = admin.getByRole("region", { name: "Specboard 팀" });
  await expect(adminBoard.getByText("내 역할 · 관리자")).toBeVisible();
  await expect(adminBoard.getByRole("link", { name: /^승인 대기/ })).toBeVisible();
  await expect(adminBoard.getByRole("link", { name: "멤버 관리" })).toBeVisible();
  // feature 행에는 상태 배지(아이콘+글자)가 있다
  const row = adminBoard.locator("div.row", { hasText: "입력 제출과 승인" }).first();
  await expect(row.locator(".badge")).toBeVisible();

  const memberBoard = member.getByRole("region", { name: "Specboard 팀" });
  await expect(memberBoard.getByText("내 역할 · 멤버")).toBeVisible();
  await expect(memberBoard.getByRole("link", { name: /^승인 대기/ })).toHaveCount(0);
  await expect(memberBoard.getByRole("link", { name: "멤버 관리" })).toHaveCount(0);
});
