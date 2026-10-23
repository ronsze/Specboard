import { beforeEach, describe, expect, it } from "vitest";
import { drainSpecJobs, requestSpecUpdate } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { submitInput, approveInput } from "@/server/services/inputs";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("동시 승인과 배치 상한 (시나리오 4)", () => {
  it("동시에 승인한 입력은 모두 빠짐없이 한 번씩만 반영된다", async () => {
    const inputs = await Promise.all(["A", "B", "C", "D"].map((c) => approvedInput(w, c)));
    await Promise.all([
      drainSpecJobs(w.feature.id, new FakeSpecWriter()),
      drainSpecJobs(w.feature.id, new FakeSpecWriter()),
      drainSpecJobs(w.feature.id, new FakeSpecWriter()),
    ]);

    const versions = await versionsOf(w.feature.id);
    const numbers = versions.map((v) => v.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);

    const used = versions.flatMap((v) => v.inputs.map((i) => i.inputId));
    expect(used.sort()).toEqual(inputs.map((i) => i.id).sort());
    expect(new Set(used).size).toBe(used.length);

    const last = versions[versions.length - 1];
    expect(last.items.map((i) => i.text).sort()).toEqual(["A", "B", "C", "D"]);
    expect(await testDb.input.count({ where: { consumedAt: null, status: "APPROVED" } })).toBe(0);
  });

  it("feature당 활성 작업은 1개다", async () => {
    await approvedInput(w, "x");
    const results = await Promise.all([requestSpecUpdate(w.feature.id), requestSpecUpdate(w.feature.id)]);
    expect(results.every((r) => r === false)).toBe(true);
    expect(await testDb.specJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(1);
  });

  it("한 번의 갱신은 입력 20개까지만 처리하고 나머지는 다음 갱신으로 넘긴다", async () => {
    for (let i = 0; i < 25; i++) await approvedInput(w, `입력 ${i}`);
    const writer = new FakeSpecWriter();
    await drainSpecJobs(w.feature.id, writer);

    const versions = await versionsOf(w.feature.id);
    expect(versions.map((v) => v.inputs.length)).toEqual([20, 5]);
    expect(writer.calls.map((c) => c.inputs.length)).toEqual([20, 5]);
    expect(versions[1].items).toHaveLength(25);
  });

  it("본문 합계가 150,000자를 넘으면 그 앞까지만 처리한다", async () => {
    for (const c of ["a", "b", "c", "d"]) await approvedInput(w, c.repeat(50_000));
    const writer = new FakeSpecWriter();
    await drainSpecJobs(w.feature.id, writer);
    expect(writer.calls.map((c) => c.inputs.length)).toEqual([3, 1]);
    expect(await versionsOf(w.feature.id)).toHaveLength(2);
  });

  it("승인 순서대로 반영한다", async () => {
    const a = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "먼저 제출, 나중 승인" });
    const b = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "나중 제출, 먼저 승인" });
    await approveInput(w.admin, w.board.id, b.id);
    await approveInput(w.admin, w.board.id, a.id);
    const writer = new FakeSpecWriter();
    await drainSpecJobs(w.feature.id, writer);
    expect(writer.calls[0].inputs.map((i) => i.content)).toEqual(["나중 제출, 먼저 승인", "먼저 제출, 나중 승인"]);
  });
});
