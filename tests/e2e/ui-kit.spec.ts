import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, forEachColorScheme } from "./helpers/a11y";

test("UI 키트: 라이트·다크 접근성 위반 0건 (SC-001)", async ({ page }) => {
  await page.goto("/dev/ui-kit");
  await forEachColorScheme(page, async (scheme) => {
    await expectNoA11yViolations(page, `ui-kit (${scheme})`);
  });
});

test("모든 배지는 아이콘과 글자를 함께 가진다 (SC-003)", async ({ page }) => {
  await page.goto("/dev/ui-kit");
  const badges = page.getByTestId("badges").locator(".badge");
  const count = await badges.count();
  expect(count).toBeGreaterThan(15);
  for (let i = 0; i < count; i++) {
    const badge = badges.nth(i);
    const text = (await badge.innerText()).trim();
    expect(text.length, `배지 ${i}에 글자가 있어야 한다`).toBeGreaterThan(0);
    if ((await badge.locator("svg").count()) === 0) {
      // 아이콘이 없는 배지는 입력 종류처럼 글자 자체가 의미인 경우만 허용
      expect(["회의록", "아이디어", "의견"]).toContain(text);
    }
  }
});

test("확인 창: 기본 포커스는 취소, Esc로 닫히고 포커스가 밖으로 나가지 않는다 (SC-002)", async ({ page }) => {
  await page.goto("/dev/ui-kit");
  const opener = page.getByRole("button", { name: "확인 창 열기" });
  // 개발 서버의 하이드레이션 전 클릭 무시를 피하려고 열릴 때까지 반복한다
  await expect(async () => {
    await opener.click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    // 모달 안에서 Tab이 끝에 닿으면 브라우저 UI로 넘어가 activeElement가 body가 된다(정상).
    // 페이지의 다른 요소가 포커스를 받으면 안 된다.
    const reachable = await page.evaluate(() => {
      const active = document.activeElement;
      return active === document.body || (document.querySelector("dialog")?.contains(active) ?? false);
    });
    expect(reachable, "Tab 이동 중 모달 밖의 페이지 요소로 포커스가 나가면 안 된다").toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
