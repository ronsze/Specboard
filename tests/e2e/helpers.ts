import type { Page } from "@playwright/test";

export const PASSWORD = "specboard123";

export async function login(page: Page, who: "admin" | "member" | "viewer") {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(`${who}@specboard.local`);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/");
}

export async function openFeature(page: Page) {
  await page.getByRole("link", { name: "입력 제출과 승인" }).click();
  await page.waitForURL(/\/inputs$/);
}
