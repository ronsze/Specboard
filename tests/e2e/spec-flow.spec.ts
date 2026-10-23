import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function approve(admin: Page, text: string) {
  await admin.getByRole("banner").getByRole("link", { name: /^승인 대기/ }).click();
  await admin.locator("article", { hasText: text }).getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article", { hasText: text })).toHaveCount(0);
}

test("입력 승인 → spec 반영 → 출처 → 이력 비교 → 되돌리기 → 확정 → 반영 대기 → 해제", async ({ browser }) => {
  test.setTimeout(150_000);
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
  const adminBase = featureBase(admin);

  // 1~2. 멤버 제출 → 관리자 승인 → spec에 항목이 나타나고 출처를 볼 수 있다
  await submitInput(member, x);
  await approve(admin, x);
  await admin.goto(`${adminBase}/spec`);
  const itemX = admin.locator("article", { hasText: x });
  await expect(itemX).toBeVisible({ timeout: 30_000 });
  await expect(itemX).toContainText("R-1");
  await clickUntil(
    () => itemX.getByRole("button", { name: /출처 1/ }).click({ timeout: 2000 }),
    () => expect(itemX.getByRole("region", { name: /출처 1개/ })).toBeVisible({ timeout: 1000 }),
  );
  await expect(itemX.getByRole("region")).toContainText("멤버");
  await expect(itemX.getByRole("region")).toContainText(x);

  // 두 번째 입력 → 두 번째 버전
  await submitInputVia(member, y);
  await approve(admin, y);
  await admin.goto(`${adminBase}/spec`);
  await expect(admin.locator("article", { hasText: y })).toBeVisible({ timeout: 30_000 });

  // 3. 이력 비교 (기본 선택: 최신 두 버전)
  await admin.goto(`${adminBase}/spec/history`);
  await expect(admin.locator("article[data-version]")).toHaveCount(2);
  const result = admin.getByRole("region", { name: "비교 결과" });
  await expect(result).toContainText("추가");
  await expect(result).toContainText(y);

  // 4. 되돌리기: 이전 버전(x만 있는 버전)으로 — 영향 미리보기 확인 후 확정
  await clickUntil(
    () => admin.locator("article[data-version]").nth(1).getByRole("button", { name: "이 버전으로 되돌리기" }).click({ timeout: 2_000 }),
    () => expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  await expect(admin.getByRole("dialog")).toContainText("항목 1개가 빠집니다");
  await admin.getByRole("dialog").getByRole("button", { name: "v1로 되돌리기" }).click();
  await admin.waitForURL(/\/spec$/);
  await expect(admin.locator("article", { hasText: x })).toBeVisible();
  await expect(admin.locator("article", { hasText: y })).toHaveCount(0);

  // 5. 확정 → 새 입력은 반영 대기
  await clickUntil(
    () => admin.getByRole("button", { name: "이 버전 확정" }).click({ timeout: 2_000 }),
    () => expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  await admin.getByRole("dialog").getByRole("button", { name: "확정", exact: true }).click();
  await expect(admin.getByText("확정됨").first()).toBeVisible();
  await submitInputVia(member, z);
  await approve(admin, z);
  await admin.goto(`${adminBase}/spec`);
  await expect(admin.getByText("승인되었으나 아직 반영되지 않은 입력 1개")).toBeVisible();
  await expect(admin.locator("article", { hasText: z })).toHaveCount(0);

  // 6. 해제 → 대기 입력이 반영된다
  await clickUntil(
    () => admin.getByRole("button", { name: "확정 해제" }).click({ timeout: 2_000 }),
    () => expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2_000 }),
  );
  await admin.getByRole("dialog").getByRole("button", { name: "확정 해제" }).click();
  await expect(admin.locator("article", { hasText: z })).toBeVisible({ timeout: 30_000 });
});

/** 멤버가 입력 화면으로 돌아가 제출한다 */
async function submitInputVia(member: Page, text: string) {
  await member.goto(`${featureBase(member)}/inputs`);
  await submitInput(member, text);
}

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
  await submitInput(admin, text);
  await admin.goto(`${featureBase(admin)}/spec`);
  await expect(admin.locator("article", { hasText: text })).toBeVisible({ timeout: 30_000 });

  await login(viewer, "viewer");
  await openFeatureByName(viewer, feature);
  await viewer.goto(`${featureBase(viewer)}/spec`);
  await expect(viewer.locator("article", { hasText: text })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "이 버전 확정" })).toHaveCount(0);
  await viewer.goto(`${featureBase(viewer)}/spec/history`);
  await expect(viewer.getByRole("button", { name: "이 버전으로 되돌리기" })).toHaveCount(0);
});
