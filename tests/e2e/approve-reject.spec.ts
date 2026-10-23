import { expect, test } from "@playwright/test";
import { login, openFeature } from "./helpers";

test("관리자가 승인하고 사유와 함께 반려하면 제출자가 결과를 확인한다", async ({ browser }) => {
  const stamp = Date.now();
  const toApprove = `승인대상-${stamp}`;
  const toReject = `반려대상-${stamp}`;

  const memberCtx = await browser.newContext({ baseURL: "http://localhost:3000" });
  const member = await memberCtx.newPage();
  await login(member, "member");
  await openFeature(member);
  for (const text of [toApprove, toReject]) {
    await member.getByLabel("내용").fill(text);
    await member.getByRole("button", { name: "제출" }).click();
    await expect(member.locator("article", { hasText: text })).toBeVisible();
  }

  const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" });
  const admin = await adminCtx.newPage();
  await login(admin, "admin");
  await openFeature(admin);
  await admin.getByRole("link", { name: "승인 대기" }).click();

  await admin.locator("article", { hasText: toApprove }).getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article", { hasText: toApprove })).toHaveCount(0);

  const rejectCard = admin.locator("article", { hasText: toReject });
  await rejectCard.getByRole("button", { name: "반려", exact: true }).click();
  await rejectCard.getByRole("button", { name: "반려 확정" }).click();
  await expect(rejectCard.locator("p.error")).toContainText("반려 사유");
  await rejectCard.getByLabel("반려 사유").fill("범위 밖");
  await rejectCard.getByRole("button", { name: "반려 확정" }).click();
  await expect(admin.locator("article", { hasText: toReject })).toHaveCount(0);

  await member.reload();
  await expect(member.locator("article", { hasText: toApprove })).toContainText("승인");
  const rejected = member.locator("article", { hasText: toReject });
  await expect(rejected).toContainText("반려");
  await expect(rejected).toContainText("사유: 범위 밖");

  await memberCtx.close();
  await adminCtx.close();
});

test("관리자 제출은 자동 승인으로 표시된다", async ({ page }) => {
  const text = `관리자입력-${Date.now()}`;
  await login(page, "admin");
  await openFeature(page);
  await page.getByLabel("내용").fill(text);
  await page.getByRole("button", { name: "제출" }).click();
  const card = page.locator("article", { hasText: text });
  await expect(card).toContainText("승인");
  await expect(card).toContainText("자동 승인");
});
