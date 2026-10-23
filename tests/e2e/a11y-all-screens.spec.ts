import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, forEachColorScheme } from "./helpers/a11y";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

async function check(page: Page, url: string, ready: () => Promise<void>) {
  await page.goto(url);
  await ready();
  await forEachColorScheme(page, async (scheme) => {
    await expectNoA11yViolations(page, `${url} (${scheme})`);
  });
}

test("모든 화면의 접근성 위반 0건: 라이트·다크 (SC-001, SC-003)", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const feature = `E2E-a11y-${stamp}`;
  const emptyFeature = `E2E-a11y-empty-${stamp}`;
  await createFeature(feature);
  await createFeature(emptyFeature);
  const base = { baseURL: "http://localhost:3000" };
  const anon = await (await browser.newContext(base)).newPage();
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();

  // 로그인(비로그인 상태)
  await check(anon, "/login", async () => {
    await expect(anon.getByRole("button", { name: "로그인" })).toBeVisible();
  });
  await anon.goto("/login?error=1&email=a%40b.c");
  await forEachColorScheme(anon, async (s) => expectNoA11yViolations(anon, `/login?error (${s})`));

  await login(admin, "admin");
  await login(member, "member");
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const [, boardId, featureId] = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${boardId}/features/${featureId}/spec`;

  // 데이터: 항목 2개 + 질문 1개(버전 3개) + 멤버의 대기 입력, 반려 입력
  await submitInput(admin, `요구 하나. 두 번째 문장 ${stamp}`);
  await waitForVersion(admin, specApi, 1);
  await submitInput(admin, `알림은 언제 보내나? ${stamp}`);
  await waitForVersion(admin, specApi, 2);
  await submitInput(admin, `답: 승인 즉시 ${stamp}`);
  await waitForVersion(admin, specApi, 3);
  await openFeatureByName(member, feature);
  await submitInput(member, `멤버의 대기 입력 ${stamp}`);

  await check(admin, "/", async () => {
    await expect(admin.getByRole("heading", { name: "내 보드" })).toBeVisible();
  });
  await check(admin, `${fb}/spec`, async () => {
    await expect(admin.locator("article", { hasText: "요구 하나" })).toBeVisible();
    // 출처 패널을 연 상태도 점검한다
    await admin.locator("article", { hasText: "요구 하나" }).getByRole("button", { name: /출처/ }).click();
  });
  await check(admin, `${fb}/inputs`, async () => {
    await expect(admin.getByRole("region", { name: "입력 목록" })).toBeVisible();
  });
  await check(admin, `/boards/${boardId}/pending`, async () => {
    await expect(admin.locator("article", { hasText: `멤버의 대기 입력 ${stamp}` })).toBeVisible();
  });
  await check(admin, `/boards/${boardId}/members`, async () => {
    await expect(admin.getByRole("heading", { name: /멤버 관리/ })).toBeVisible();
  });
  await check(admin, `${fb}/spec/history?all=1`, async () => {
    await expect(admin.getByRole("region", { name: "비교 결과" })).toContainText("비교");
  });

  // 빈 상태: 입력이 없는 feature의 spec·입력 화면
  await admin.goto("/");
  await admin.getByRole("link", { name: emptyFeature }).click();
  await admin.waitForURL(/\/spec$/);
  await check(admin, admin.url(), async () => {
    await expect(admin.getByText("아직 승인된 입력이 없습니다")).toBeVisible();
  });
  await check(admin, admin.url().replace(/\/spec$/, "/inputs"), async () => {
    await expect(admin.getByText("아직 입력이 없습니다")).toBeVisible();
  });

  // 403 / 404
  await check(member, `/boards/${boardId}/members`, async () => {
    await expect(member.getByText("이 화면을 볼 권한이 없습니다")).toBeVisible();
  });
  await check(member, "/boards/no-such-board", async () => {
    await expect(member.getByText("찾을 수 없습니다")).toBeVisible();
  });
});
