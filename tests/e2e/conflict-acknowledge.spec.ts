import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

test("경고 확인: 한 번 클릭으로 접힌 '확인됨', 확인자·시각, 펼쳐보기, 입력은 대기 유지, 키보드 조작 (시나리오 16, SC-007)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-ack-${stamp}`;
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
  const text = `쿠폰은 두 장까지 중복 적용을 허용하자. ${stamp}`;
  await submitInput(member, text);

  await admin.goto(`/boards/${ids[1]}/pending?feature=${ids[2]}`);
  const card = admin.locator("article.input-card", { hasText: text });
  await expect(card.getByText("충돌 가능성", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(admin.getByText(/아직 확인하지 않은 경고 \d+개/)).toBeVisible();

  // 키보드로 확인: 포커스 후 Enter
  const button = card.getByRole("button", { name: "확인함" });
  await clickUntil(
    async () => { await button.focus(); await admin.keyboard.press("Enter"); },
    async () => { await expect(card.locator("details.warning--ack")).toBeVisible({ timeout: 2000 }); },
  );
  const ack = card.locator("details.warning--ack");
  await expect(ack).toContainText("확인됨");
  await expect(ack).toContainText("관리자");
  await expect(ack).toContainText(/\d\d-\d\d \d\d:\d\d/);

  // 펼치면 이유·발췌가 그대로 보인다
  await ack.locator("summary").click();
  await expect(ack).toContainText("이유");
  await expect(ack.locator("mark")).toBeVisible();

  // 입력은 여전히 대기, 승인 버튼도 그대로
  await expect(card.getByRole("button", { name: "승인" })).toBeVisible();
  await expect(card.getByText("대기", { exact: true }).first()).toBeVisible();
});
