import { expect, test, type Page } from "@playwright/test";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

test("처리된 입력의 경고는 이력으로 남고 관리자 입력 화면에서만 보인다 (시나리오 17, 19)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-proc-${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(member, "member");
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  await submitInput(admin, `쿠폰은 주문 한 건에 한 장만 적용한다 ${stamp}`);
  await waitForVersion(admin, `/api/boards/${ids[1]}/features/${ids[2]}/spec`, 1);

  await openFeatureByName(member, feature);
  const toApprove = `쿠폰은 두 장까지 중복 적용을 허용하자. A ${stamp}`;
  const toReject = `쿠폰은 두 장까지 중복 적용을 허용하자. B ${stamp}`;
  await submitInput(member, toApprove);
  await submitInput(member, toReject);

  await admin.goto(`/boards/${ids[1]}/pending`);
  const a = admin.locator("article.input-card", { hasText: toApprove });
  const r = admin.locator("article.input-card", { hasText: toReject });
  await expect(a.getByText("충돌 가능성", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(r.getByText("충돌 가능성", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await a.getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article.input-card", { hasText: toApprove })).toHaveCount(0);
  await r.getByRole("button", { name: /^반려…/ }).click();
  await r.getByLabel(/반려 사유/).fill("범위 밖입니다");
  await r.getByRole("button", { name: "반려 확정" }).click();
  await expect(admin.locator("article.input-card", { hasText: toReject })).toHaveCount(0);

  // 관리자 입력 화면: 처리됨 경고가 남아 있다. 필터를 바꿔도 동작한다
  await admin.goto(`${fb}/inputs`);
  const approved = admin.locator("article.input-card", { hasText: toApprove });
  await expect(approved.getByText("처리됨(승인됨)").first()).toBeVisible();
  await expect(approved.getByText(/경고 1개 보기/)).toBeVisible();
  await approved.getByText(/경고 1개 보기/).click();
  await expect(approved).toContainText("R-1");
  await expect(approved).toContainText("이유");
  // 처리된 입력에는 "다시 검사" 안내가 나오지 않는다
  await expect(approved).not.toContainText("다시 검사할 수 있습니다");
  const rejected = admin.locator("article.input-card", { hasText: toReject });
  await expect(rejected.getByText("처리됨(반려됨)").first()).toBeVisible();
  await admin.getByRole("link", { name: /^반려/ }).click();
  await admin.waitForURL(/filter=rejected/);
  await expect(admin.locator("article.input-card", { hasText: toReject }).getByText("처리됨(반려됨)").first()).toBeVisible();

  // 멤버 화면에는 경고·검사 표시가 없다
  await member.goto(`${fb}/inputs`);
  await expect(member.locator("article.input-card", { hasText: toApprove })).toBeVisible();
  await expect(member.getByText(/충돌|처리됨\(/)).toHaveCount(0);
});
