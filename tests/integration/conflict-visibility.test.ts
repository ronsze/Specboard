import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, listInputs, listInputsView, submitInput, listApprovedInputs } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { listBoardPending } from "@/server/services/board-pending";
import { getSpec } from "@/server/services/spec";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
let inputId: string;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."], true);
  const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 중복 적용을 허용하자." });
  inputId = input.id;
  await drainConflictChecks({ inputId }, new FakeConflictDetector());
});

const view = (user: World["admin"]) => listInputsView(user, w.board.id, w.feature.id);
const hasConflictKey = (o: object) => "conflict" in o;

describe("가시성: 검사·경고는 관리자에게만 (FR-019, SC-005, 시나리오 19)", () => {
  it("보드 승인 대기(관리자 전용)는 conflict를 포함한다", async () => {
    const [item] = await listBoardPending(w.admin, w.board.id);
    expect(item.conflict?.warnings).toHaveLength(1);
    expect(item.conflict?.warnings[0].onFinalizedSpec).toBe(true);
  });

  it("입력 뷰: 관리자 응답에만 conflict 키가 있고 멤버·열람자·제출자 응답에는 키 자체가 없다", async () => {
    const admin = (await view(w.admin)).inputs.find((i) => i.id === inputId)!;
    expect(hasConflictKey(admin)).toBe(true);
    for (const user of [w.member, w.viewer]) {
      const result = await view(user);
      for (const i of result.inputs) expect(hasConflictKey(i)).toBe(false);
    }
    // 제출자 본인(멤버)이 자신의 입력을 보는 경우도 동일
    const own = (await view(w.member)).inputs.find((i) => i.id === inputId)!;
    expect(hasConflictKey(own)).toBe(false);
    expect(JSON.stringify(await view(w.member))).not.toContain("conflict");
  });

  it("다른 서비스 응답(listInputs, listApprovedInputs, getSpec)에는 검사 정보가 섞이지 않는다", async () => {
    await approveInput(w.admin, w.board.id, inputId);
    for (const result of [await listInputs(w.admin, w.board.id, w.feature.id), await listApprovedInputs(w.member, w.board.id, w.feature.id)]) {
      expect(JSON.stringify(result)).not.toContain("conflict");
      expect(JSON.stringify(result)).not.toContain("warnings");
    }
    expect(JSON.stringify(await getSpec(w.viewer, w.board.id, w.feature.id))).not.toContain("conflict");
  });

  it("멤버·열람자·비멤버의 승인 대기 조회는 403", async () => {
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(listBoardPending(user, w.board.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(view(w.outsider)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
