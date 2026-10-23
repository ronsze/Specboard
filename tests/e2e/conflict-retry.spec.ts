import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

test("낡은 검사: '검사 이후 spec 갱신' 안내와 다시 검사, 기준 버전 표시, 멤버 화면 비노출 (시나리오 11, 12, 19, SC-010)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-retry-${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(member, "member");

  // 첫 spec 버전
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}/spec`;
  await submitInput(admin, `쿠폰은 주문 한 건에 한 장만 적용한다 ${stamp}`);
  await waitForVersion(admin, specApi, 1);

  // 멤버 입력 → 검사 완료(v1 기준)
  await openFeatureByName(member, feature);
  const text = `쿠폰은 두 장까지 중복 적용을 허용하자. ${stamp}`;
  await submitInput(member, text);
  await admin.goto(`/boards/${ids[1]}/pending?feature=${ids[2]}`);
  const card = admin.locator("article.input-card", { hasText: text });
  await expect(card.getByText("v1 기준")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("button", { name: "다시 검사" })).toHaveCount(0);

  // spec이 새 버전이 되면 낡았다는 안내와 다시 검사가 나타난다
  await admin.goto(`${fb}/inputs`);
  await submitInput(admin, `환불은 7일 이내로 한다 ${stamp}`);
  await waitForVersion(admin, specApi, 2);
  await admin.goto(`/boards/${ids[1]}/pending?feature=${ids[2]}`);
  const stale = admin.locator("article.input-card", { hasText: text });
  await expect(stale.getByText(/검사 이후 spec이 새 버전\(v2\)으로 갱신되었습니다/)).toBeVisible();
  const button = stale.getByRole("button", { name: "다시 검사" });
  // 클릭은 하이드레이션 전에 무시될 수 있어, 버튼이 사라질 때(검사 중으로 바뀔 때)까지 반복한다
  await clickUntil(
    async () => {
      if ((await button.count()) > 0) await button.click({ timeout: 2000 });
    },
    async () => { await expect(button).toHaveCount(0, { timeout: 3000 }); },
  );
  await expect(stale.getByText("v2 기준")).toBeVisible({ timeout: 30_000 });
  // 그동안 승인·반려는 가능하다
  await expect(stale.getByRole("button", { name: "승인" })).toBeVisible();

  // 멤버 화면에는 어떤 표시도 없다
  await member.goto(`${fb}/inputs`);
  await expect(member.getByText(/검사|충돌|다시 검사/)).toHaveCount(0);
});
