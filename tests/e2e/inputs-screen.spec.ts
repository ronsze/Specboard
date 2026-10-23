import { expect, test } from "@playwright/test";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

test("입력 화면: 필터, 펼치기, 본인 대기 안내, 글자 수 카운터 (시나리오 10~12, 21)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-in-${stamp}`;
  await createFeature(feature);
  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  const other = await (await browser.newContext(base)).newPage();
  const viewer = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await login(viewer, "viewer");
  await openFeatureByName(member, feature);
  await openFeatureByName(viewer, feature);

  // 제출 폼: 글자 수 카운터와 제출 후 흐름 안내
  await expect(member.getByText("제출 후 흐름")).toBeVisible();
  await member.getByLabel("본문").fill("가나다");
  await expect(member.getByText("3 / 50,000")).toBeVisible();

  // 긴 본문(50,000자에 가깝게)도 제출되고, 접혀 있다가 펼쳐진다
  const long = `긴 회의록 ${stamp}\n` + "회의 내용 한 줄입니다.\n".repeat(2000);
  await member.getByLabel("본문").fill(long);
  await member.getByRole("button", { name: "제출하기" }).click();
  const card = member.locator("article", { hasText: `긴 회의록 ${stamp}` });
  await expect(card).toBeVisible();
  const toggle = card.getByRole("button", { name: /펼치기/ });
  await expect(toggle).toContainText(/전체 [\d,]+자/);
  await expect(card).toContainText("나와 관리자에게만 보임");
  await toggle.click();
  await expect(card.getByRole("button", { name: /접기/ })).toBeVisible();
  // 레이아웃이 깨지지 않는다 (가로 스크롤 없음)
  const overflow = await member.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  // 필터: 주소에 반영되고 새로고침 후에도 유지, 내 대기만 남는다
  await submitInput(member, `짧은 입력 ${stamp}`);
  await member.getByRole("link", { name: /^내 대기/ }).click();
  await member.waitForURL(/filter=mine-pending/);
  await member.reload();
  await expect(member.getByRole("link", { name: /^내 대기/ })).toHaveAttribute("aria-current", "true");
  await expect(member.locator("article", { hasText: `짧은 입력 ${stamp}` })).toBeVisible();

  // 결과가 없는 필터는 빈 상태 안내
  await member.getByRole("link", { name: /^반려/ }).click();
  await expect(member.getByText("조건에 맞는 입력이 없습니다")).toBeVisible();

  // 다른 멤버에게는 타인의 대기 입력이 보이지 않는다 (같은 보드의 다른 계정이 없으므로 열람자로 확인)
  await viewer.goto(`${featureBase(viewer)}/inputs`);
  await expect(viewer.locator("article", { hasText: `짧은 입력 ${stamp}` })).toHaveCount(0);
  await expect(viewer.getByRole("form", { name: "입력 제출" })).toHaveCount(0);
  void other;
});
