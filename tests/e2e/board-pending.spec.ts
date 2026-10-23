import { expect, test } from "@playwright/test";
import { createFeature, login, openFeatureByName, submitInput } from "./helpers";

test("보드 단위 승인 대기: 여러 feature를 한 화면에서 처리하고 배지가 갱신된다 (시나리오 13, 14, 21)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const f1 = `E2E-p1-${stamp}`;
  const f2 = `E2E-p2-${stamp}`;
  await createFeature(f1);
  await createFeature(f2);
  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  const admin = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await login(admin, "admin");

  await openFeatureByName(member, f1);
  await submitInput(member, `첫 feature 입력 ${stamp}`);
  await member.goto("/");
  await openFeatureByName(member, f2);
  await submitInput(member, `둘째 feature 입력 ${stamp}`);

  // 멤버에게는 메뉴·배지가 없다
  await expect(member.getByRole("link", { name: /^승인 대기/ })).toHaveCount(0);

  await admin.goto("/");
  await openFeatureByName(admin, f1);
  const badge = admin.getByRole("link", { name: /^승인 대기/ });
  await expect(badge).toBeVisible();
  await badge.click();
  await admin.waitForURL(/\/pending$/);

  const first = admin.locator("article", { hasText: `첫 feature 입력 ${stamp}` });
  const second = admin.locator("article", { hasText: `둘째 feature 입력 ${stamp}` });
  await expect(first).toContainText(f1);
  await expect(second).toContainText(f2);

  // 승인
  await first.getByRole("button", { name: "승인" }).click();
  await expect(first).toHaveCount(0);

  // 반려: 사유 비면 확정 불가, 취소 가능, 사유 입력 후 가능
  await second.getByRole("button", { name: /^반려…/ }).click();
  await second.getByRole("button", { name: "반려 확정" }).click();
  await expect(second.locator("p.error-text")).toContainText("반려 사유");
  await second.getByRole("button", { name: "취소" }).click();
  await expect(second.getByRole("button", { name: /^반려…/ })).toBeVisible();
  await second.getByRole("button", { name: /^반려…/ }).click();
  await second.getByLabel(/반려 사유/).fill("이번 범위 밖");
  await second.getByRole("button", { name: "반려 확정" }).click();
  await expect(second).toHaveCount(0);
});

test("멤버가 승인 대기 주소로 직접 들어가면 403 안내가 보인다 (시나리오 21)", async ({ browser }) => {
  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await member.getByRole("link", { name: "입력 제출과 승인" }).click();
  await member.waitForURL(/\/inputs$/);
  const boardPending = member.url().replace(/\/features\/.*$/, "/pending");
  await member.goto(boardPending);
  await expect(member.getByText("이 화면을 볼 권한이 없습니다")).toBeVisible();
  await expect(member.getByText("지금 내 역할은 멤버입니다")).toBeVisible();
});
