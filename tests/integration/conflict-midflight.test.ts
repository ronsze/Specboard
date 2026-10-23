import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, rejectInput, submitInput } from "@/server/services/inputs";
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

const submit = () => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 허용하자." });

describe("검사 도중 처리·중단 (시나리오 18)", () => {
  it("검사 도중 입력이 승인되어도 검사는 끝까지 수행되고 입력 상태는 승인이다", async () => {
    const input = await submit();
    const detector = new FakeConflictDetector({ duringCall: async () => { await approveInput(w.admin, w.board.id, input.id); } });
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } })).toMatchObject({ status: "DONE" });
    expect(await testDb.conflictWarning.count({ where: { inputId: input.id } })).toBe(1);
    expect(await testDb.input.findUniqueOrThrow({ where: { id: input.id } })).toMatchObject({ status: "APPROVED" });
  });

  it("검사 도중 입력이 반려되어도 같다", async () => {
    const input = await submit();
    const detector = new FakeConflictDetector({ duringCall: async () => { await rejectInput(w.admin, w.board.id, input.id, { reason: "범위 밖" }); } });
    await drainConflictChecks({ inputId: input.id }, detector);
    expect(await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } })).toMatchObject({ status: "DONE" });
    expect(await testDb.input.findUniqueOrThrow({ where: { id: input.id } })).toMatchObject({ status: "REJECTED" });
  });

  it("임대가 만료된 RUNNING 검사는 회수되어 이어서 처리된다", async () => {
    const input = await submit();
    await testDb.conflictCheck.updateMany({ where: { inputId: input.id }, data: { status: "RUNNING", leaseUntil: new Date(Date.now() - 1000) } });
    await drainConflictChecks({ boardId: w.board.id }, new FakeConflictDetector());
    expect(await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } })).toMatchObject({ status: "DONE" });
  });
});
