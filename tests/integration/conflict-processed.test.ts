import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, listInputsView, rejectInput, submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { acknowledgeWarning } from "@/server/services/conflicts";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."], true);
});

const conflicted = async () => {
  const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 중복 적용을 허용하자." });
  await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
  return input;
};
const adminView = async (id: string) => (await listInputsView(w.admin, w.board.id, w.feature.id)).inputs.find((i) => i.id === id) as unknown as { conflict: Record<string, unknown> & { warnings: { acknowledged: unknown }[] } };

describe("처리된 입력의 경고 이력 (시나리오 17)", () => {
  it("승인하면 processedAs=APPROVED이고 경고·확인 기록이 보존된다", async () => {
    const input = await conflicted();
    const warning = await testDb.conflictWarning.findFirstOrThrow({ where: { inputId: input.id } });
    await acknowledgeWarning(w.admin, w.board.id, warning.id);
    await approveInput(w.admin, w.board.id, input.id);
    const view = await adminView(input.id);
    expect(view.conflict).toMatchObject({ processedAs: "APPROVED", state: "DONE", recheckable: false });
    expect(view.conflict.warnings).toHaveLength(1);
    expect(view.conflict.warnings[0].acknowledged).not.toBeNull();
  });

  it("반려하면 processedAs=REJECTED로 남는다", async () => {
    const input = await conflicted();
    await rejectInput(w.admin, w.board.id, input.id, { reason: "확정된 결정과 충돌" });
    const view = await adminView(input.id);
    expect(view.conflict).toMatchObject({ processedAs: "REJECTED" });
    expect(view.conflict.warnings).toHaveLength(1);
  });

  it("처리된 입력도 멤버·열람자·제출자 응답에는 conflict가 없다", async () => {
    const input = await conflicted();
    await approveInput(w.admin, w.board.id, input.id);
    for (const user of [w.member, w.viewer]) {
      const found = (await listInputsView(user, w.board.id, w.feature.id)).inputs.find((i) => i.id === input.id)!;
      expect("conflict" in found).toBe(false);
    }
  });
});
