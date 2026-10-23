import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, rejectInput, submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { loadConflictViews } from "@/server/services/conflict-view";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const CONFLICT = "쿠폰은 두 장까지 중복 적용을 허용하자.";
const submit = (content = CONFLICT) => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content });
const view = async (inputId: string) => {
  const input = await testDb.input.findUniqueOrThrow({ where: { id: inputId } });
  return (await loadConflictViews([{ id: input.id, featureId: input.featureId, status: input.status }])).get(inputId);
};
const run = (inputId: string, opts = {}) => drainConflictChecks({ inputId }, new FakeConflictDetector(opts));

describe("ConflictView (시나리오 1~5, 21)", () => {
  beforeEach(async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
  });

  it("검사 전에는 CHECKING, 후에는 DONE과 경고(번호·문구·이유·발췌)", async () => {
    const input = await submit();
    expect(await view(input.id)).toMatchObject({ state: "CHECKING", warnings: [], recheckable: false });
    await run(input.id);
    const v = (await view(input.id))!;
    expect(v).toMatchObject({ state: "DONE", baseVersion: 1, currentSpecVersion: 1, stale: false, recheckable: false, processedAs: null });
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toMatchObject({ label: "R-1", kind: "REQUIREMENT", onFinalizedSpec: false, acknowledged: null });
    expect(v.warnings[0].itemText).toContain("한 장만");
    expect(CONFLICT.slice(v.warnings[0].quote!.start, v.warnings[0].quote!.end)).toBe(CONFLICT);
    expect(v.unacknowledgedCount).toBe(1);
    expect(v.checkedAt).not.toBeNull();
  });

  it("FAILED는 failure와 recheckable, 처리된 입력은 recheckable이 아니고 processedAs가 나온다", async () => {
    const input = await submit();
    await run(input.id, { failWith: "TIMEOUT" });
    expect(await view(input.id)).toMatchObject({ state: "FAILED", failure: { code: "TIMEOUT", attempts: 3 }, recheckable: true });
    await approveInput(w.admin, w.board.id, input.id);
    expect(await view(input.id)).toMatchObject({ recheckable: false, processedAs: "APPROVED" });
  });

  it("검사 이후 spec이 새 버전이 되면 stale이고 recheckable이다", async () => {
    const input = await submit();
    await run(input.id);
    await seedSpecItems(w, ["환불은 7일 이내"]);
    expect(await view(input.id)).toMatchObject({ state: "DONE", baseVersion: 1, currentSpecVersion: 2, stale: true, recheckable: true });
  });

  it("반려된 입력의 processedAs는 REJECTED", async () => {
    const input = await submit();
    await run(input.id);
    await rejectInput(w.admin, w.board.id, input.id, { reason: "범위 밖" });
    expect(await view(input.id)).toMatchObject({ processedAs: "REJECTED", recheckable: false });
  });

  it("검사 기록이 없는 입력은 null", async () => {
    const adminInput = await submitInput(w.admin, w.board.id, w.feature.id, { kind: "IDEA", content: "관리자 입력" });
    expect(await view(adminInput.id)).toBeNull();
  });

  it("경고는 확정 충돌이 먼저, 그다음 생성 순이다", async () => {
    const input = await submit();
    await run(input.id);
    const check = await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } });
    const base = { checkId: check.id, inputId: input.id, itemKind: "REQUIREMENT" as const, itemNumber: 9, itemText: "x", reason: "r" };
    await testDb.conflictWarning.create({ data: { ...base, itemKey: "late-final", onFinalizedSpec: true } });
    const v = (await view(input.id))!;
    expect(v.warnings.map((x) => x.onFinalizedSpec)).toEqual([true, false]);
  });
});

describe("검사 안 함 (SKIPPED)", () => {
  it("spec 없이 제출된 입력은 SKIPPED이고, 이후 spec이 생기면 stale·recheckable이다", async () => {
    const input = await submit("쿠폰은 두 장까지");
    expect(await view(input.id)).toMatchObject({ state: "SKIPPED", skipReason: "NO_SPEC", stale: false, recheckable: false, currentSpecVersion: null });
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    expect(await view(input.id)).toMatchObject({ state: "SKIPPED", stale: true, recheckable: true, currentSpecVersion: 1 });
  });
});

describe("조회 쿼리 수", () => {
  it("입력 수에 비례하지 않는다", async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
    const queries: string[] = [];
    const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
    client.$on("query", (e: { query: string }) => queries.push(e.query));
    try {
      const make = async (n: number) => {
        const ids = [];
        for (let i = 0; i < n; i++) ids.push(await submit(`입력 ${Math.random()}`));
        return ids.map((i) => ({ id: i.id, featureId: w.feature.id, status: "PENDING" as const }));
      };
      const few = await make(3);
      queries.length = 0;
      await loadConflictViews(few, client);
      const baseline = queries.length;
      const many = await make(30);
      queries.length = 0;
      await loadConflictViews([...few, ...many], client);
      expect(queries.length).toBe(baseline);
    } finally {
      await client.$disconnect();
    }
  });
});
