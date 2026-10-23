import { expect, test, type Page } from "@playwright/test";
import { createFeature, login, openFeatureByName } from "./helpers";

async function submit(page: Page, text: string) {
  await page.getByLabel("내용").fill(text);
  await page.getByRole("button", { name: "제출" }).click();
  await expect(page.locator("article", { hasText: text })).toBeVisible();
}

/** 개발 서버에서는 하이드레이션 전의 클릭이 무시될 수 있어, 다음 UI가 나타날 때까지 클릭을 반복한다. */
async function clickUntilVisible(click: () => Promise<void>, next: () => Promise<void>) {
  await expect(async () => {
    await click();
    await next();
  }).toPass({ timeout: 15_000 });
}

async function approve(admin: Page, text: string) {
  await admin.getByRole("link", { name: "승인 대기" }).click();
  await admin.locator("article", { hasText: text }).getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article", { hasText: text })).toHaveCount(0);
  await admin.getByRole("link", { name: "← 입력 목록" }).click();
}

test("입력 승인 → spec 반영 → 출처 → 이력 비교 → 되돌리기 → 확정 → 반영 대기 → 해제", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-${stamp}`;
  const x = `결제는 카드만 지원한다 ${stamp}`;
  const y = `환불은 7일 이내 ${stamp}`;
  const z = `확정 이후 입력 ${stamp}`;
  await createFeature(feature);

  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  const admin = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await login(admin, "admin");
  await openFeatureByName(member, feature);
  await openFeatureByName(admin, feature);

  // 1~2. 멤버 제출 → 관리자 승인 → spec에 항목이 나타나고 출처를 볼 수 있다
  await submit(member, x);
  await approve(admin, x);
  await admin.getByRole("link", { name: "spec 보기" }).click();
  const itemX = admin.locator("article", { hasText: x });
  await expect(itemX).toBeVisible({ timeout: 30_000 });
  await itemX.getByText("출처 1개 보기").click();
  await expect(itemX.getByText(x, { exact: true }).last()).toBeVisible();
  await expect(itemX).toContainText("멤버");

  // 두 번째 입력 → 두 번째 버전
  await admin.goBack();
  await submit(member, y);
  await approve(admin, y);
  await admin.getByRole("link", { name: "spec 보기" }).click();
  await expect(admin.locator("article", { hasText: y })).toBeVisible({ timeout: 30_000 });

  // 3. 이력 비교
  await admin.getByRole("link", { name: "버전 이력" }).click();
  await expect(admin.locator("article[data-version]")).toHaveCount(2);
  await admin.getByRole("button", { name: "비교" }).click();
  const result = admin.getByRole("region", { name: "비교 결과" });
  await expect(result).toContainText("추가");
  await expect(result).toContainText(y);

  // 4. 되돌리기: 이전 버전(x만 있는 버전)으로
  await clickUntilVisible(
    () => admin.locator("article[data-version]").nth(1).getByRole("button", { name: "이 버전으로 되돌리기" }).click({ timeout: 2_000 }),
    () => expect(admin.getByRole("button", { name: "되돌리기 확정" })).toBeVisible({ timeout: 2_000 }),
  );
  await admin.getByRole("button", { name: "되돌리기 확정" }).click();
  await admin.waitForURL(/\/spec$/);
  await expect(admin.locator("article", { hasText: x })).toBeVisible();
  await expect(admin.locator("article", { hasText: y })).toHaveCount(0);

  // 5. 확정 → 새 입력은 반영 대기
  await clickUntilVisible(
    () => admin.getByRole("button", { name: "spec 확정" }).click({ timeout: 2_000 }),
    () => expect(admin.getByRole("button", { name: "확정", exact: true })).toBeVisible({ timeout: 2_000 }),
  );
  await admin.getByRole("button", { name: "확정", exact: true }).click();
  await expect(admin.getByText("확정", { exact: true }).first()).toBeVisible();
  await member.reload();
  await submit(member, z);
  await admin.getByRole("link", { name: "← 입력 목록" }).click();
  await approve(admin, z);
  await admin.getByRole("link", { name: "spec 보기" }).click();
  await expect(admin.getByText("반영 대기 입력 1개")).toBeVisible();
  await expect(admin.locator("article", { hasText: z })).toHaveCount(0);

  // 6. 해제 → 대기 입력이 반영된다
  await admin.getByRole("button", { name: "확정 해제" }).click();
  await expect(admin.locator("article", { hasText: z })).toBeVisible({ timeout: 30_000 });
});

test("열람자에게는 되돌리기·확정 버튼이 보이지 않는다", async ({ browser }) => {
  const stamp = Date.now();
  const feature = `E2E-view-${stamp}`;
  const text = `열람자 확인 ${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const viewer = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await openFeatureByName(admin, feature);
  await submit(admin, text);
  await admin.getByRole("link", { name: "spec 보기" }).click();
  await expect(admin.locator("article", { hasText: text })).toBeVisible({ timeout: 30_000 });

  await login(viewer, "viewer");
  await openFeatureByName(viewer, feature);
  await viewer.getByRole("link", { name: "spec 보기" }).click();
  await expect(viewer.locator("article", { hasText: text })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "spec 확정" })).toHaveCount(0);
  await viewer.getByRole("link", { name: "버전 이력" }).click();
  await expect(viewer.getByRole("button", { name: "이 버전으로 되돌리기" })).toHaveCount(0);
});
