import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { finalizeSpec, unfinalizeSpec } from "@/server/services/spec";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const CONFLICT = "쿠폰은 두 장까지 중복 적용을 허용하자.";
const submit = (content = CONFLICT, user = w.member) =>
  submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content });
const checksOf = (inputId: string) => testDb.conflictCheck.findMany({ where: { inputId }, include: { warnings: true } });

describe("충돌 검사 등록·실행 (시나리오 1~3, 15)", () => {
  it("멤버 제출 시 QUEUED 검사가 등록되고 drain 후 DONE과 경고가 저장된다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    expect((await checksOf(input.id)).map((c) => c.status)).toEqual(["QUEUED"]);

    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const [check] = await checksOf(input.id);
    expect(check).toMatchObject({ status: "DONE", baseVersionNumber: 1, model: "fake" });
    expect(check.warnings).toHaveLength(1);
    expect(check.warnings[0]).toMatchObject({ itemNumber: 1, itemKind: "REQUIREMENT", onFinalizedSpec: false });
    expect(check.warnings[0].itemText).toContain("한 장만");
  });

  it("확정된 spec이면 경고의 onFinalizedSpec=true", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."], true);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    expect((await checksOf(input.id))[0].warnings[0].onFinalizedSpec).toBe(true);
  });

  it("검사 도중 확정되면 저장 시점의 상태로 기록하고, 이후 확정을 해제해도 경고는 바뀌지 않는다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    const detector = new FakeConflictDetector({ duringCall: async () => { await finalizeSpec(w.admin, w.board.id, w.feature.id); } });
    await drainConflictChecks({ inputId: input.id }, detector);
    expect((await checksOf(input.id))[0].warnings[0].onFinalizedSpec).toBe(true);

    await unfinalizeSpec(w.admin, w.board.id, w.feature.id);
    expect((await checksOf(input.id))[0].warnings[0].onFinalizedSpec).toBe(true);
  });

  it("관리자 제출(자동 승인)은 검사 행이 없다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit(CONFLICT, w.admin);
    expect(await checksOf(input.id)).toEqual([]);
  });

  it("모순 없는 입력은 경고 없이 DONE", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit("쿠폰 코드는 대소문자를 구분하지 않았으면 좋겠다. 장바구니 UI도 개선하자");
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const [check] = await checksOf(input.id);
    expect(check.status).toBe("DONE");
    expect(check.warnings.every((x) => x.itemKey)).toBe(true);
  });

  it("입력당 활성 검사는 1개이고 동시 drain에도 한 번만 실행된다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    const detector = new FakeConflictDetector();
    await Promise.all([
      drainConflictChecks({ inputId: input.id }, detector),
      drainConflictChecks({ inputId: input.id }, detector),
      drainConflictChecks({ boardId: w.board.id }, detector),
    ]);
    expect(detector.calls).toHaveLength(1);
    expect(await testDb.conflictCheck.count({ where: { inputId: input.id } })).toBe(1);
  });

  it("검사 실패와 무관하게 제출은 성공하고 입력은 대기 상태다 (FR-013)", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ failWith: "API_ERROR" }));
    expect(await testDb.input.findUniqueOrThrow({ where: { id: input.id } })).toMatchObject({ status: "PENDING" });
  });
});
