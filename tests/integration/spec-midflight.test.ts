import { beforeEach, describe, expect, it } from "vitest";
import { revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  for (const text of ["A", "B"]) {
    await approvedInput(w, text);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
});

describe("AI 호출 중 되돌리기 (시나리오 20)", () => {
  it("기준 버전이 달라졌으면 결과를 폐기하고, 입력은 미소비로 남아 되돌려진 내용 위에 한 번만 반영된다", async () => {
    const c = await approvedInput(w, "C");
    let reverted = false;
    const writer = new FakeSpecWriter({
      duringCall: async () => {
        if (reverted) return;
        reverted = true;
        await revertSpec(w.admin, w.board.id, w.feature.id, 1);
      },
    });
    await drainSpecJobs(w.feature.id, writer);

    expect(writer.calls).toHaveLength(2); // 첫 호출은 폐기, 재큐 후 다시 호출
    const versions = await versionsOf(w.feature.id);
    expect(versions.map((v) => [v.number, v.kind])).toEqual([
      [1, "AI_UPDATE"],
      [2, "AI_UPDATE"],
      [3, "REVERT"],
      [4, "AI_UPDATE"],
    ]);
    // 폐기된 결과(A, B, C)가 아니라 되돌려진 A 위에 C만 얹힌다
    expect(versions[3].items.map((i) => i.text)).toEqual(["A", "C"]);
    expect(versions[3].inputs.map((i) => i.inputId)).toEqual([c.id]);
    expect(await testDb.input.count({ where: { consumedAt: null, status: "APPROVED" } })).toBe(0);
    expect(await testDb.specJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(0);
  });
});
