import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("비교할 spec이 없을 때 (시나리오 14)", () => {
  it("spec이 없으면 AI 호출 없이 즉시 SKIPPED(NO_SPEC)", async () => {
    const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 허용" });
    const [check] = await testDb.conflictCheck.findMany({ where: { inputId: input.id } });
    expect(check).toMatchObject({ status: "SKIPPED", skipReason: "NO_SPEC" });
    expect(check.completedAt).not.toBeNull();
    const detector = new FakeConflictDetector();
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(detector.calls).toHaveLength(0);
  });

  it("항목이 0개인 spec은 NO_ITEMS", async () => {
    const spec = await testDb.spec.create({ data: { featureId: w.feature.id } });
    await testDb.specVersion.create({ data: { specId: spec.id, number: 1, kind: "AI_UPDATE" } });
    const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "x" });
    expect(await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } })).toMatchObject({
      status: "SKIPPED",
      skipReason: "NO_ITEMS",
    });
  });
});
