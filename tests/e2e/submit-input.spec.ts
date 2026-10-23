import { expect, test } from "@playwright/test";
import { login, openFeature } from "./helpers";

test("멤버가 아이디어 한 줄을 제출하면 대기로 표시된다", async ({ page }) => {
  const text = `아이디어-${Date.now()}`;
  await login(page, "member");
  await openFeature(page);

  await page.getByRole("button", { name: "제출" }).click();
  await expect(page.locator("p.error")).toContainText("내용을 입력");

  await page.getByLabel("내용").fill(text);
  await page.getByRole("button", { name: "제출" }).click();

  const card = page.locator("article", { hasText: text });
  await expect(card).toBeVisible();
  await expect(card).toContainText("대기");
});

test("열람자에게는 제출 폼이 보이지 않는다", async ({ page }) => {
  await login(page, "viewer");
  await openFeature(page);
  await expect(page.getByRole("form", { name: "입력 제출" })).toHaveCount(0);
});
