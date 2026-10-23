import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
});

const submit = (content = "쿠폰은 두 장까지 허용하자.") => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content });
const lastCheck = (inputId: string) => testDb.conflictCheck.findFirstOrThrow({ where: { inputId }, orderBy: { createdAt: "desc" } });

describe("검사 실패 처리 (시나리오 11)", () => {
  it("API 오류가 두 번 나도 세 번째 시도에서 성공한다", async () => {
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ failWith: "API_ERROR", failTimes: 2 }));
    expect(await lastCheck(input.id)).toMatchObject({ status: "DONE", attempts: 3 });
  });

  it("계속 실패하면 3회 시도 뒤 FAILED이고 입력 상태는 그대로다", async () => {
    const input = await submit();
    const detector = new FakeConflictDetector({ failWith: "TIMEOUT" });
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(detector.calls).toHaveLength(3);
    expect(await lastCheck(input.id)).toMatchObject({ status: "FAILED", lastError: "TIMEOUT", attempts: 3 });
    expect(await testDb.input.findUniqueOrThrow({ where: { id: input.id } })).toMatchObject({ status: "PENDING" });
    expect(await testDb.conflictWarning.count({ where: { inputId: input.id } })).toBe(0);
  });

  it("거절(REFUSED)은 재시도 없이 바로 FAILED", async () => {
    const input = await submit();
    const detector = new FakeConflictDetector({ failWith: "REFUSED" });
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(detector.calls).toHaveLength(1);
    expect(await lastCheck(input.id)).toMatchObject({ status: "FAILED", lastError: "REFUSED" });
  });

  it("비교 항목이 300개를 넘으면 AI 호출 없이 TOO_LARGE", async () => {
    const spec = await testDb.spec.findFirstOrThrow();
    const version = await testDb.specVersion.findFirstOrThrow({ where: { specId: spec.id } });
    const input = await submit();
    await testDb.specItem.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({ versionId: version.id, key: `bulk-${i}`, kind: "REQUIREMENT" as const, text: `항목 ${i}`, position: 100 + i, number: 100 + i })),
    });
    const detector = new FakeConflictDetector();
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(detector.calls).toHaveLength(0);
    expect(await lastCheck(input.id)).toMatchObject({ status: "FAILED", lastError: "TOO_LARGE" });
  });

  it("본문 합계가 150,000자를 넘으면 TOO_LARGE", async () => {
    const spec = await testDb.spec.findFirstOrThrow();
    const version = await testDb.specVersion.findFirstOrThrow({ where: { specId: spec.id } });
    await testDb.specItem.create({ data: { versionId: version.id, key: "huge", kind: "REQUIREMENT", text: "가".repeat(2000), position: 50, number: 50 } });
    await testDb.specItem.updateMany({ where: { key: "huge" }, data: { text: "가".repeat(2000) } });
    const input = await submit("나".repeat(50_000));
    await testDb.$executeRaw`UPDATE "SpecItem" SET "text" = repeat('가', 100000) WHERE "key" = 'huge'`;
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    expect(await lastCheck(input.id)).toMatchObject({ status: "FAILED", lastError: "TOO_LARGE" });
  });
});
