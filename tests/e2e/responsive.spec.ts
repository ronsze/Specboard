import { expect, test } from "@playwright/test";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

test("휴대폰 너비: spec 보기와 입력 제출은 가로 스크롤이 없고 질문이 항목 위에 온다 (시나리오 24)", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const feature = `E2E-mobile-${stamp}`;
  await createFeature(feature);
  const ctx = await browser.newContext({ baseURL: "http://localhost:3000", viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await login(page, "admin");
  await openFeatureByName(page, feature);
  const fb = featureBase(page);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}`;

  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  // 입력 제출 화면: 폼이 목록 위에 있고 가로 스크롤이 없다
  await expect(page.getByRole("form", { name: "입력 제출" })).toBeVisible();
  expect(await noOverflow()).toBe(true);
  await submitInput(page, `요구 ${stamp}. 긴 문장이 모바일에서도 줄바꿈되어야 합니다 `.repeat(3));
  await submitInput(page, `질문이 있나? ${stamp}?`);
  expect(await noOverflow()).toBe(true);

  await expect
    .poll(async () => (await (await page.request.get(`${specApi}/spec`)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(2);

  // spec 보기: 가로 스크롤 없음, 미결 질문이 항목 목록보다 위
  await page.goto(`${fb}/spec`);
  await expect(page.getByRole("region", { name: "미결 질문" })).toBeVisible();
  expect(await noOverflow()).toBe(true);
  const questionBox = await page.getByRole("region", { name: "미결 질문" }).boundingBox();
  const itemBox = await page.getByRole("region", { name: "spec 항목" }).boundingBox();
  expect(questionBox!.y).toBeLessThan(itemBox!.y);
});
