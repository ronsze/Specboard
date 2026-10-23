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
  await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."], true);
});

const withWarning = async () => {
  const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 중복 적용을 허용하자." });
  await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
  expect(await testDb.conflictWarning.count({ where: { inputId: input.id } })).toBe(1);
  return input;
};

describe("경고는 승인·반려를 막지 않는다 (FR-008, 시나리오 10)", () => {
  it("경고가 있는 입력을 추가 확인 없이 승인할 수 있다", async () => {
    const input = await withWarning();
    const approved = await approveInput(w.admin, w.board.id, input.id);
    expect(approved).toMatchObject({ status: "APPROVED", decidedByName: "관리자" });
  });

  it("경고가 있는 입력을 사유와 함께 반려할 수 있다", async () => {
    const input = await withWarning();
    const rejected = await rejectInput(w.admin, w.board.id, input.id, { reason: "확정된 결정과 충돌" });
    expect(rejected).toMatchObject({ status: "REJECTED", rejectionReason: "확정된 결정과 충돌" });
  });

  it("처리 후에도 경고와 검사 기록은 그대로 남는다", async () => {
    const input = await withWarning();
    await approveInput(w.admin, w.board.id, input.id);
    expect(await testDb.conflictWarning.count({ where: { inputId: input.id } })).toBe(1);
    expect(await testDb.conflictCheck.count({ where: { inputId: input.id, status: "DONE" } })).toBe(1);
  });
});
