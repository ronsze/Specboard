import { expect, test, type Page } from "@playwright/test";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

test("승인 화면에서 충돌 경고: 확정 충돌 강조, 일반 경고 구분, 없음, 승인 가능, 비관리자 비노출 (시나리오 1~5, 10, 19, 21)", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const featureA = `E2E-cw-final-${stamp}`;
  const featureB = `E2E-cw-open-${stamp}`;
  await createFeature(featureA);
  await createFeature(featureB);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();
  const viewer = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(member, "member");
  await login(viewer, "viewer");

  // feature A: 확정된 spec
  await openFeatureByName(admin, featureA);
  const baseA = featureBase(admin);
  const idsA = baseA.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApiA = `/api/boards/${idsA[1]}/features/${idsA[2]}/spec`;
  const finalText = `쿠폰은 주문 한 건에 한 장만 적용한다 ${stamp}`;
  await submitInput(admin, finalText);
  await waitForVersion(admin, specApiA, 1);
  expect((await admin.request.post(`${specApiA}/finalize`)).ok()).toBe(true);

  // feature B: 확정되지 않은 spec
  await admin.goto("/");
  await openFeatureByName(admin, featureB);
  const baseB = featureBase(admin);
  const idsB = baseB.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApiB = `/api/boards/${idsB[1]}/features/${idsB[2]}/spec`;
  const openText = `쿠폰은 주문 한 건에 한 장만 적용한다 ${stamp}`;
  await submitInput(admin, openText);
  await waitForVersion(admin, specApiB, 1);

  // 멤버 제출: A에 모순, A에 무관, B에 모순
  const conflictA = `쿠폰은 두 장까지 중복 적용을 허용하자. ${stamp}`;
  const harmless = `배송 안내 문구를 더 친절하게 바꾸자 ${stamp}`;
  const conflictB = `쿠폰은 두 장까지 중복 적용을 허용하자. B ${stamp}`;
  await member.goto(`${baseA}/inputs`);
  await submitInput(member, conflictA);
  await submitInput(member, harmless);
  await member.goto(`${baseB}/inputs`);
  await submitInput(member, conflictB);

  // 관리자: 보드 승인 대기
  await admin.goto(`/boards/${idsA[1]}/pending`);
  const cardA = admin.locator("article.input-card", { hasText: conflictA });
  await expect(cardA.getByText("확정된 결정과 충돌 가능")).toBeVisible({ timeout: 30_000 });
  await expect(cardA).toContainText("R-1");
  await expect(cardA).toContainText("쿠폰은 주문 한 건에 한 장만 적용한다");
  await expect(cardA.getByText("이유")).toBeVisible();
  await expect(cardA.locator("mark")).toContainText("쿠폰은 두 장까지 중복 적용을 허용하자.");
  await expect(cardA.getByText("v1 기준")).toBeVisible();

  const cardB = admin.locator("article.input-card", { hasText: conflictB });
  await expect(cardB.getByText("충돌 가능성", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(cardB.getByText("확정된 결정과 충돌 가능")).toHaveCount(0);

  const cardH = admin.locator("article.input-card", { hasText: harmless });
  await expect(cardH.getByText("충돌 가능성 없음")).toBeVisible({ timeout: 30_000 });

  await expect(admin.getByText(/충돌 가능성이 있는 입력 \d+개 · 아직 확인하지 않은 경고 \d+개/)).toBeVisible();

  // 경고가 있어도 추가 확인 없이 승인된다
  await cardA.getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article.input-card", { hasText: conflictA })).toHaveCount(0);

  // 멤버·열람자 화면에는 충돌 검사 표시가 없다
  await member.goto(`${baseB}/inputs`);
  await expect(member.locator("article", { hasText: conflictB })).toBeVisible();
  await expect(member.getByText(/충돌/)).toHaveCount(0);
  await viewer.goto(`${baseA}/inputs`);
  await expect(viewer.getByText(/충돌/)).toHaveCount(0);
});
