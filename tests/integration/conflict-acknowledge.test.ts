import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { acknowledgeWarning } from "@/server/services/conflicts";
import { listBoardPending } from "@/server/services/board-pending";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
let inputId: string;
let warningId: string;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
  const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "쿠폰은 두 장까지 중복 적용을 허용하자." });
  inputId = input.id;
  await drainConflictChecks({ inputId }, new FakeConflictDetector());
  warningId = (await testDb.conflictWarning.findFirstOrThrow({ where: { inputId } })).id;
});

const ack = (user = w.admin, id = warningId, boardId = w.board.id) => acknowledgeWarning(user, boardId, id);

describe("경고 확인 (시나리오 16, 20)", () => {
  it("확인하면 확인자·시각이 기록되고 입력의 상태는 바뀌지 않는다", async () => {
    const view = await ack();
    expect(view.acknowledged).toMatchObject({ byName: "관리자" });
    expect(new Date(view.acknowledged!.at).getTime()).toBeGreaterThan(0);
    expect(await testDb.input.findUniqueOrThrow({ where: { id: inputId } })).toMatchObject({ status: "PENDING", decidedBy: null });
    const [pending] = await listBoardPending(w.admin, w.board.id);
    expect(pending.conflict).toMatchObject({ unacknowledgedCount: 0, state: "DONE" });
    expect(pending.conflict!.warnings[0].acknowledged).not.toBeNull();
  });

  it("이미 확인된 경고를 다시 확인해도 멱등이다 (기록이 바뀌지 않는다)", async () => {
    const first = await ack();
    const second = await ack();
    expect(second.acknowledged).toEqual(first.acknowledged);
    const row = await testDb.conflictWarning.findUniqueOrThrow({ where: { id: warningId } });
    expect(row.acknowledgedByName).toBe("관리자");
  });

  it("다른 관리자가 다시 확인해도 처음 확인자 기록이 유지된다", async () => {
    await ack();
    await testDb.membership.update({ where: { boardId_userId: { boardId: w.board.id, userId: w.member2.id } }, data: { role: "ADMIN" } });
    const view = await ack(w.member2);
    expect(view.acknowledged?.byName).toBe("관리자");
  });

  it("확인하지 않고도 승인할 수 있고, 확인 후에도 승인 기록에는 영향이 없다", async () => {
    await approveInput(w.admin, w.board.id, inputId);
    expect(await testDb.input.findUniqueOrThrow({ where: { id: inputId } })).toMatchObject({ status: "APPROVED" });
    await ack();
    expect(await testDb.input.findUniqueOrThrow({ where: { id: inputId } })).toMatchObject({ status: "APPROVED" });
  });

  it("다른 보드의 경고나 없는 경고는 404", async () => {
    const other = await testDb.board.create({ data: { name: "다른 보드" } });
    await testDb.membership.create({ data: { boardId: other.id, userId: w.admin.id, role: "ADMIN" } });
    await expect(ack(w.admin, warningId, other.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(ack(w.admin, "no-such-warning")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("멤버·열람자·비멤버는 403", async () => {
    for (const user of [w.member, w.viewer, w.outsider]) await expect(ack(user)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await testDb.conflictWarning.findUniqueOrThrow({ where: { id: warningId } })).acknowledgedAt).toBeNull();
  });
});
