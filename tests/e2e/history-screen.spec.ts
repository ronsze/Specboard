import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specUrl: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specUrl)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

test("이력 화면: A/B 선택, 요약, 동일 항목 토글, 되돌리기 영향 미리보기와 확인 창 (시나리오 18~20)", async ({ browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const feature = `E2E-hist-${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const other = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(other, "admin");
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}/spec`;

  // 관리자 제출은 자동 승인되어 입력마다 버전이 생긴다
  for (const [i, t] of ["첫째", "둘째", "셋째"].entries()) {
    await submitInput(admin, `${t} 요구 ${stamp}`);
    await waitForVersion(admin, specApi, i + 1);
  }

  await admin.goto(`${fb}/spec/history`);
  const cards = admin.locator("article[data-version]");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("현재");

  // 기본 선택은 최신 두 버전(A=v2, B=v3): 추가 1, 동일 2
  const result = admin.getByRole("region", { name: "비교 결과" });
  await expect(result).toContainText("v2 → v3 비교");
  await expect(result).toContainText("추가 1");
  await expect(result).toContainText("동일 2");

  // 체크박스로 v1을 고르면 오래된 선택이 해제되고 v1 → v3 비교가 된다
  await clickUntil(
    () => admin.getByRole("checkbox", { name: "v1 비교 선택" }).check({ timeout: 2000 }),
    () => expect(result).toContainText("v1 → v3 비교", { timeout: 1500 }),
  );
  await expect(result).toContainText("추가 2");
  await expect(result).toContainText("동일 1");

  // 변경 없는 항목은 기본 숨김, 토글하면 보인다
  await expect(result.locator('[data-change="NONE"]')).toHaveCount(0);
  await admin.getByRole("link", { name: "변경 없는 항목도 보기" }).click();
  await expect(result.locator('[data-change="NONE"]')).toHaveCount(1);

  // 선택을 하나로 줄이면 안내가 나온다 (같은 버전끼리는 비교되지 않는다)
  await admin.goto(`${fb}/spec/history?a=3`);
  await expect(admin.getByText("비교할 두 버전을 선택하세요")).toBeVisible();

  // 되돌리기 확인 창: 영향, 기본 포커스 취소, Esc 닫기
  await admin.goto(`${fb}/spec/history`);
  const v1 = admin.locator('article[data-version="1"]');
  await clickUntil(
    () => v1.getByRole("button", { name: "이 버전으로 되돌리기" }).click({ timeout: 2000 }),
    () => expect(admin.getByRole("dialog")).toBeVisible({ timeout: 1500 }),
  );
  const dialog = admin.getByRole("dialog");
  await expect(dialog).toContainText("v1로 되돌릴까요?");
  await expect(dialog).toContainText("새 버전 v4");
  await expect(dialog).toContainText("항목 2개가 빠집니다");
  await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
  await admin.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // 미리보기를 연 뒤 spec이 바뀌면 실행되지 않고 최신 영향을 다시 보여준다 (FR-030)
  await v1.getByRole("button", { name: "이 버전으로 되돌리기" }).click();
  await expect(dialog).toBeVisible();
  await other.goto(`${fb}/inputs`);
  await submitInput(other, `넷째 요구 ${stamp}`);
  await waitForVersion(other, specApi, 4);
  await dialog.getByRole("button", { name: "v1로 되돌리기" }).click();
  await expect(dialog).toContainText("미리보기 이후 spec이 바뀌었습니다");
  await expect(dialog).toContainText("새 버전 v5");
  await expect(dialog).toContainText("항목 3개가 빠집니다");

  // 다시 확인하고 실행하면 되돌려진다
  await dialog.getByRole("button", { name: "v1로 되돌리기" }).click();
  await admin.waitForURL(/\/spec$/);
  await expect(admin.locator("article", { hasText: `첫째 요구 ${stamp}` })).toBeVisible();
  await expect(admin.locator("article", { hasText: `둘째 요구 ${stamp}` })).toHaveCount(0);
});

test("확정 상태에서는 되돌리기 버튼 대신 안내가 보인다 (시나리오 21)", async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const feature = `E2E-hist-lock-${stamp}`;
  await createFeature(feature);
  const admin = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  await login(admin, "admin");
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}/spec`;
  for (const [i, t] of ["가", "나"].entries()) {
    await submitInput(admin, `${t} ${stamp}`);
    await waitForVersion(admin, specApi, i + 1);
  }
  await admin.request.post(`${specApi}/finalize`);

  await admin.goto(`${fb}/spec/history`);
  await expect(admin.getByText("확정된 동안에는 되돌릴 수 없습니다")).toBeVisible();
  await expect(admin.getByRole("button", { name: "이 버전으로 되돌리기" })).toHaveCount(0);
  await expect(admin.getByRole("link", { name: "Spec 화면에서 확정을 해제" })).toBeVisible();
});
