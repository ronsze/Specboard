import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, submitInput } from "@/server/services/inputs";
import { drainConflictChecks, retryConflictCheck } from "@/server/services/conflict-checks";
import { acknowledgeWarning } from "@/server/services/conflicts";
import { listBoardPending } from "@/server/services/board-pending";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const CONFLICT = "쿠폰은 두 장까지 중복 적용을 허용하자.";
const submit = (content = CONFLICT) => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content });
const retry = (inputId: string, user = w.admin) => retryConflictCheck(user, w.board.id, inputId);
const checksOf = (inputId: string) => testDb.conflictCheck.findMany({ where: { inputId }, orderBy: { createdAt: "asc" } });
const conflictOf = async () => (await listBoardPending(w.admin, w.board.id))[0].conflict!;

describe("다시 검사 (시나리오 11~13)", () => {
  it("FAILED+PENDING 입력은 새 검사가 등록되고 이전 기록이 보존되며 최신 결과가 새 검사로 바뀐다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ failWith: "API_ERROR" }));
    expect((await conflictOf()).state).toBe("FAILED");

    await retry(input.id);
    expect((await conflictOf()).state).toBe("CHECKING");
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const checks = await checksOf(input.id);
    expect(checks.map((c) => c.status)).toEqual(["FAILED", "DONE"]);
    expect(await conflictOf()).toMatchObject({ state: "DONE", recheckable: false });
    expect((await conflictOf()).warnings).toHaveLength(1);
  });

  it("spec이 없을 때 제출되어 SKIPPED인 입력은 spec이 생기면 다시 검사할 수 있다", async () => {
    const input = await submit();
    await expect(retry(input.id)).rejects.toMatchObject({ status: 409, details: { code: "NOT_RECHECKABLE" } });
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    await retry(input.id);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    expect(await conflictOf()).toMatchObject({ state: "DONE", baseVersion: 1 });
    expect((await conflictOf()).warnings).toHaveLength(1);
  });

  it("검사 뒤 spec이 갱신된(stale) DONE 입력도 가능하고 새 검사는 최신 버전 기준이다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    await seedSpecItems(w, ["환불은 7일 이내"]);
    expect(await conflictOf()).toMatchObject({ stale: true, recheckable: true, baseVersion: 1, currentSpecVersion: 2 });
    await retry(input.id);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    expect(await conflictOf()).toMatchObject({ state: "DONE", baseVersion: 2, stale: false, recheckable: false });
  });

  it("다시 검사할 수 없는 경우는 409와 사유 코드를 준다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    // 진행 중
    await expect(retry(input.id)).rejects.toMatchObject({ status: 409, details: { code: "ALREADY_RUNNING" } });
    // 최신 spec 기준으로 성공
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    await expect(retry(input.id)).rejects.toMatchObject({ status: 409, details: { code: "NOT_RECHECKABLE" } });
    // 처리된 입력
    await approveInput(w.admin, w.board.id, input.id);
    await expect(retry(input.id)).rejects.toMatchObject({ status: 409, details: { code: "INPUT_PROCESSED" } });
  });

  it("이전에 확인했던 항목과 같은 항목의 새 경고는 확인되지 않은 상태로 시작한다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const first = await testDb.conflictWarning.findFirstOrThrow({ where: { inputId: input.id } });
    await acknowledgeWarning(w.admin, w.board.id, first.id);
    await seedSpecItems(w, ["환불은 7일 이내"]); // 낡게 만든다
    await retry(input.id);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const view = await conflictOf();
    expect(view.warnings.every((x) => x.acknowledged === null)).toBe(true);
    // 이전 검사의 확인 기록은 보존된다
    expect((await testDb.conflictWarning.findUniqueOrThrow({ where: { id: first.id } })).acknowledgedAt).not.toBeNull();
  });

  it("멤버·열람자·비멤버는 403", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const input = await submit();
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ failWith: "API_ERROR" }));
    for (const user of [w.member, w.viewer, w.outsider]) await expect(retry(input.id, user)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await checksOf(input.id)).toHaveLength(1);
  });
});
