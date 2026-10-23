import { expect, test, type Page } from "@playwright/test";
import { clickUntil, createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function approveAll(admin: Page, texts: string[]) {
  await admin.getByRole("banner").getByRole("link", { name: /^승인 대기/ }).click();
  for (const text of texts) {
    await admin.locator("article", { hasText: text }).getByRole("button", { name: "승인" }).click();
    await expect(admin.locator("article", { hasText: text })).toHaveCount(0);
  }
}

test("spec 화면: 번호, 출처 두 번 클릭, 미결 질문, 상태 안내 (시나리오 3~5, 17, 21)", async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const feature = `E2E-spec-${stamp}`;
  const req = `쿠폰은 한 장만 적용한다 ${stamp}`;
  const question = `쿠폰과 적립금을 함께 쓸 수 있나? ${stamp}?`;
  await createFeature(feature);

  const base = { baseURL: "http://localhost:3000" };
  const member = await (await browser.newContext(base)).newPage();
  const admin = await (await browser.newContext(base)).newPage();
  await login(member, "member");
  await login(admin, "admin");
  await openFeatureByName(member, feature);
  await openFeatureByName(admin, feature);
  const adminBase = featureBase(admin);

  // 입력이 없을 때의 안내
  await admin.goto(`${adminBase}/spec`);
  await expect(admin.getByText("아직 승인된 입력이 없습니다")).toBeVisible();

  await submitInput(member, req);
  await submitInput(member, question);
  await approveAll(admin, [req, question]);
  await admin.goto(`${adminBase}/spec`);

  // 항목 번호와 provenance 표시
  const item = admin.locator("article", { hasText: req });
  await expect(item).toBeVisible({ timeout: 30_000 });
  await expect(item).toContainText("R-1");
  await expect(item).toContainText("AI 정리");
  await expect(item).toContainText(/v\d+부터|v\d+에서 추가/);

  // 미결 질문 레일: 열림 1, 해소 0 (항목과 구별되는 영역)
  const rail = admin.getByRole("region", { name: "미결 질문" });
  await expect(rail).toContainText("열림 1 · 해소 0");
  await expect(rail).toContainText("Q-1");

  // 출처 확인은 클릭 두 번 이내: 칩 → 패널(입력 번호·제출자·승인) → 원문 전체 보기 링크
  await clickUntil(
    () => item.getByRole("button", { name: /출처 1/ }).click({ timeout: 2000 }),
    () => expect(item.getByRole("region", { name: /출처 1개/ })).toBeVisible({ timeout: 1000 }),
  );
  const panel = item.getByRole("region", { name: /출처 1개/ });
  await expect(panel).toContainText(/IN-\d+/);
  await expect(panel).toContainText("멤버");
  await expect(panel).toContainText("승인");
  await panel.getByRole("link", { name: /원문 전체 보기/ }).click();
  await admin.waitForURL(/\/inputs#IN-\d+$/);

  // 관리자 전용 컨트롤은 관리자에게만 보인다
  await admin.goto(`${adminBase}/spec`);
  await expect(admin.getByRole("button", { name: "이 버전 확정" })).toBeVisible();
  await member.goto(`${adminBase}/spec`);
  await expect(member.locator("article", { hasText: req })).toBeVisible();
  await expect(member.getByRole("button", { name: "이 버전 확정" })).toHaveCount(0);
  await expect(member.getByRole("link", { name: "질문에 답하는 입력 제출" })).toBeVisible();

  // 확정 상태 안내
  await clickUntil(
    () => admin.getByRole("button", { name: "이 버전 확정" }).click({ timeout: 2000 }),
    () => expect(admin.getByRole("dialog")).toBeVisible({ timeout: 1500 }),
  );
  await admin.getByRole("dialog").getByRole("button", { name: "확정", exact: true }).click();
  await expect(admin.getByText("확정됨").first()).toBeVisible();
  await expect(admin.getByRole("button", { name: "확정 해제" })).toBeVisible();
});
