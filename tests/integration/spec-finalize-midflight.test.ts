import { beforeEach, describe, expect, it } from "vitest";
import { finalizeSpec, getSpec, unfinalizeSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await approvedInput(w, "A");
  await drainSpecJobs(w.feature.id, new FakeSpecWriter());
});

describe("AI 호출 중 확정", () => {
  it("결과를 폐기하고 입력은 미소비로 남으며, 해제 후 반영된다", async () => {
    const b = await approvedInput(w, "B");
    const writer = new FakeSpecWriter({
      duringCall: async () => {
        await finalizeSpec(w.admin, w.board.id, w.feature.id);
      },
    });
    await drainSpecJobs(w.feature.id, writer);

    expect(await versionsOf(w.feature.id)).toHaveLength(1);
    expect(await testDb.input.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "APPROVED", consumedAt: null });
    expect(await testDb.specJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(0);
    expect(await getSpec(w.viewer, w.board.id, w.feature.id)).toMatchObject({ status: "FINALIZED", pendingInputCount: 1 });

    await unfinalizeSpec(w.admin, w.board.id, w.feature.id);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const versions = await versionsOf(w.feature.id);
    expect(versions).toHaveLength(2);
    expect(versions[1].items.map((i) => i.text)).toEqual(["A", "B"]);
  });
});
