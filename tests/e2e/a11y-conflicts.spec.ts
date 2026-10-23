import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, forEachColorScheme } from "./helpers/a11y";
import { createFeature, featureBase, login, openFeatureByName, submitInput } from "./helpers";

async function waitForVersion(page: Page, specApi: string, n: number) {
  await expect
    .poll(async () => (await (await page.request.get(specApi)).json()).version?.number ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
}

async function withDb<T>(fn: (db: import("@prisma/client").PrismaClient) => Promise<T>) {
  const { config } = await import("dotenv");
  config({ path: ".env", quiet: true });
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

test("충돌 경고의 모든 상태를 라이트·다크로 점검: 위반 0건, 키보드 조작 (003 SC-001~003)", async ({ browser }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const withSpec = `E2E-a11yc-${stamp}`;
  const noSpec = `E2E-a11yc-nospec-${stamp}`;
  await createFeature(withSpec);
  await createFeature(noSpec);
  const base = { baseURL: "http://localhost:3000" };
  const admin = await (await browser.newContext(base)).newPage();
  const member = await (await browser.newContext(base)).newPage();
  await login(admin, "admin");
  await login(member, "member");

  await openFeatureByName(admin, withSpec);
  const fb = featureBase(admin);
  const ids = fb.match(/boards\/([^/]+)\/features\/([^/]+)/)!;
  const specApi = `/api/boards/${ids[1]}/features/${ids[2]}/spec`;
  await submitInput(admin, `쿠폰은 주문 한 건에 한 장만 적용한다 ${stamp}`);
  await waitForVersion(admin, specApi, 1);
  expect((await admin.request.post(`${specApi}/finalize`)).ok()).toBe(true);

  // 입력들: 확정 충돌 / 충돌 없음 / 확인될 경고 / 처리될 입력 / 검사 중으로 바꿀 입력 / 실패로 바꿀 입력
  const texts = {
    finalConflict: `쿠폰은 두 장까지 중복 적용을 허용하자. 확정 ${stamp}`,
    none: `배송 안내 문구를 더 친절하게 바꾸자 ${stamp}`,
    toAck: `쿠폰은 두 장까지 중복 적용을 허용하자. 확인 ${stamp}`,
    toApprove: `쿠폰은 두 장까지 중복 적용을 허용하자. 처리 ${stamp}`,
    checking: `쿠폰은 두 장까지 허용하자. 검사중 ${stamp}`,
    failed: `쿠폰은 두 장까지 허용하자. 실패 ${stamp}`,
  };
  await openFeatureByName(member, withSpec);
  for (const t of Object.values(texts)) await submitInput(member, t);
  await member.goto("/");
  await openFeatureByName(member, noSpec);
  const skipped = `스펙 없는 feature의 입력 ${stamp}`;
  await submitInput(member, skipped);

  const pending = `/boards/${ids[1]}/pending`;
  await admin.goto(pending);
  for (const key of ["finalConflict", "none", "toAck", "toApprove", "checking", "failed"] as const) {
    await expect(admin.locator("article.input-card", { hasText: texts[key] }).locator(".conflict-panel")).not.toContainText("검사 중", { timeout: 30_000 });
  }

  // DB로 상태를 만든다: 검사 중(RUNNING, 임대 유효), 실패
  await withDb(async (db) => {
    const find = (t: string) => db.input.findFirstOrThrow({ where: { content: t } });
    const chk = await find(texts.checking);
    await db.conflictCheck.updateMany({ where: { inputId: chk.id }, data: { status: "RUNNING", leaseUntil: new Date(Date.now() + 3_600_000) } });
    const fail = await find(texts.failed);
    await db.conflictCheck.updateMany({ where: { inputId: fail.id }, data: { status: "FAILED", lastError: "API_ERROR", attempts: 3 } });
  });

  // 확인된 경고, 처리됨(승인됨)
  await admin.goto(pending);
  const ackCard = admin.locator("article.input-card", { hasText: texts.toAck });
  await ackCard.getByRole("button", { name: "확인함" }).click();
  await expect(ackCard.locator("details.warning--ack")).toBeVisible();
  const approveCard = admin.locator("article.input-card", { hasText: texts.toApprove });
  await approveCard.getByRole("button", { name: "승인" }).click();
  await expect(admin.locator("article.input-card", { hasText: texts.toApprove })).toHaveCount(0);

  // 점검: 상태가 모두 있는 승인 대기 화면 (검사 중·실패·검사 안 함·확정 충돌·없음·확인됨)
  await admin.goto(pending);
  const panelOf = (t: string) => admin.locator("article.input-card", { hasText: t }).locator(".conflict-panel");
  await expect(panelOf(texts.finalConflict)).toContainText("확정된 결정과 충돌 가능");
  await expect(panelOf(texts.none)).toContainText("충돌 가능성 없음");
  await expect(panelOf(texts.checking)).toContainText("충돌 검사 중");
  await expect(panelOf(texts.failed)).toContainText("검사 실패");
  await expect(panelOf(skipped)).toContainText("비교할 spec 없음");
  await forEachColorScheme(admin, async (scheme) => {
    await expectNoA11yViolations(admin, `충돌 상태 모음 승인 대기 (${scheme})`);
  });

  // 처리됨(승인됨) 경고가 있는 feature 입력 화면(관리자 보기)
  await admin.goto(`${fb}/inputs`);
  await admin.locator("article.input-card", { hasText: texts.toApprove }).getByText(/경고 1개 보기/).click();
  await forEachColorScheme(admin, async (scheme) => {
    await expectNoA11yViolations(admin, `관리자 입력 화면 (${scheme})`);
  });

  // 다른 테스트에 영향이 없도록 임시로 만든 '검사 중'·'실패' 상태를 정리한다 (화면에 계속 자동 갱신이 걸리지 않게)
  await withDb(async (db) => {
    await db.conflictCheck.updateMany({ where: { status: "RUNNING", input: { content: texts.checking } }, data: { status: "DONE", leaseUntil: null, completedAt: new Date() } });
  });
});
