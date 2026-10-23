import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName } from "./helpers";

/** 포인터 없이 포커스 이동과 키 입력만으로 조작한다. */
async function focusAndPress(page: Page, locator: ReturnType<Page["getByRole"]>, key = "Enter") {
  await locator.focus();
  await expect(locator).toBeFocused();
  await page.keyboard.press(key);
}

test("키보드만으로 제출 → 승인 → 출처 펼침 → 필터 → 비교 선택 → 되돌리기 → 확정·해제 (SC-002)", async ({ browser }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const feature = `E2E-kbd-${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  const admin = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await login(admin, "admin");
  await openFeatureByName(member, feature);
  await openFeatureByName(admin, feature);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}/spec`;

  // 제출 (멤버): 라디오 → 본문 → 제출 버튼
  for (const text of [`키보드 제출 하나 ${stamp}`, `키보드 제출 둘 ${stamp}`]) {
    await member.getByLabel("본문").focus();
    await member.keyboard.type(text);
    await focusAndPress(member, member.getByRole("button", { name: "제출하기" }));
    await expect(member.locator("article", { hasText: text })).toBeVisible();
  }

  // 승인 (관리자): 승인 버튼에 포커스 후 Enter
  await admin.goto(`/boards/${ids[1]}/pending`);
  for (const text of [`키보드 제출 하나 ${stamp}`, `키보드 제출 둘 ${stamp}`]) {
    const card = admin.locator("article", { hasText: text });
    await focusAndPress(admin, card.getByRole("button", { name: "승인" }));
    await expect(card).toHaveCount(0);
  }
  await expect
    .poll(async () => (await (await admin.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);

  // 출처 펼침: 칩에 포커스 후 Enter
  await admin.goto(`${fb}/spec`);
  const item = admin.locator("article", { hasText: `키보드 제출 하나 ${stamp}` });
  await expect(item).toBeVisible();
  await clickUntil(
    async () => { await focusAndPress(admin, item.getByRole("button", { name: /출처/ })); },
    async () => { await expect(item.getByRole("region", { name: /출처/ })).toBeVisible({ timeout: 1500 }); },
  );

  // 필터: 링크에 포커스 후 Enter
  await admin.goto(`${fb}/inputs`);
  await focusAndPress(admin, admin.getByRole("link", { name: /^반영 대기/ }));
  await admin.waitForURL(/filter=reflect-pending/);

  // 비교 선택: 체크박스에서 Space
  await admin.goto(`${fb}/spec/history`);
  const checkbox = admin.getByRole("checkbox", { name: "v1 비교 선택" });
  await clickUntil(
    async () => { await checkbox.focus(); await admin.keyboard.press("Space"); },
    async () => { await expect(admin.getByRole("region", { name: "비교 결과" })).toContainText("비교", { timeout: 1500 }); },
  );

  // 되돌리기: 버튼 Enter → 확인 창에서 Tab/Enter, Esc로 닫기도 가능
  const revertButton = admin.locator('article[data-version="1"]').getByRole("button", { name: "이 버전으로 되돌리기" });
  await clickUntil(
    async () => { await focusAndPress(admin, revertButton); },
    async () => { await expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2500 }); },
  );
  await expect(admin.getByRole("dialog").getByRole("button", { name: "취소" })).toBeFocused();
  await admin.keyboard.press("Escape");
  await expect(admin.getByRole("dialog")).toBeHidden();
  await focusAndPress(admin, revertButton);
  await expect(admin.getByRole("dialog")).toBeVisible();
  await admin.keyboard.press("Tab"); // 취소 → 되돌리기
  await expect(admin.getByRole("dialog").getByRole("button", { name: "v1로 되돌리기" })).toBeFocused();
  await admin.keyboard.press("Enter");
  await admin.waitForURL(/\/spec$/);

  // 확정·해제: 버튼 Enter → 창에서 확정 → 해제
  const lock = admin.getByRole("button", { name: "이 버전 확정" });
  await clickUntil(
    async () => { await focusAndPress(admin, lock); },
    async () => { await expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2500 }); },
  );
  await focusAndPress(admin, admin.getByRole("dialog").getByRole("button", { name: "확정", exact: true }));
  await expect(admin.getByText("확정됨").first()).toBeVisible();
  await clickUntil(
    async () => { await focusAndPress(admin, admin.getByRole("button", { name: "확정 해제" })); },
    async () => { await expect(admin.getByRole("dialog")).toBeVisible({ timeout: 2500 }); },
  );
  await focusAndPress(admin, admin.getByRole("dialog").getByRole("button", { name: "확정 해제" }));
  await expect(admin.getByRole("button", { name: "이 버전 확정" })).toBeVisible();
});
