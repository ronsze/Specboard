import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { drainConflictChecks } from "@/server/services/conflict-checks";
import { revertSpec } from "@/server/services/spec";
import { FakeConflictDetector } from "@/server/ai/fake-conflict-detector";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, seedSpecItems } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const submit = (content: string) => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content });
const warningsOf = (inputId: string) => testDb.conflictWarning.findMany({ where: { inputId } });
const CONFLICT = "쿠폰은 두 장까지 중복 적용을 허용하자.";

describe("저장 검증 (시나리오 6~9)", () => {
  beforeEach(async () => {
    await seedSpecItems(w, ["쿠폰은 주문 한 건에 한 장만 적용한다."]);
  });

  it("존재하지 않는 항목 key의 경고는 저장되지 않는다", async () => {
    const input = await submit(CONFLICT);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ ghostKey: true }));
    const warnings = await warningsOf(input.id);
    expect(warnings.map((x) => x.itemKey)).not.toContain("ghost-key");
    expect(warnings).toHaveLength(1);
  });

  it("검사 도중 되돌리기로 항목이 사라지면 그 경고는 저장되지 않는다", async () => {
    await seedSpecItems(w, ["환불은 7일 이내"]); // v2: 두 번째 항목 추가
    await testDb.input.deleteMany({ where: { status: "PENDING" } });
    const input = await submit("쿠폰은 두 장까지 허용하고 환불은 14일로 하자. 환불은 허용하지 않는다고 했던 7일 이내를 제한 없이");
    const detector = new FakeConflictDetector({
      duringCall: async () => { await revertSpec(w.admin, w.board.id, w.feature.id, 1); }, // v1: 쿠폰 항목만 남는다
    });
    await drainConflictChecks({ inputId: input.id }, detector);
    const warnings = await warningsOf(input.id);
    expect(warnings.every((x) => x.itemText.includes("쿠폰"))).toBe(true);
    expect(warnings.some((x) => x.itemText.includes("환불"))).toBe(false);
  });

  it("원문에 없는 발췌는 null로 저장되고 경고는 유지된다", async () => {
    const input = await submit(CONFLICT);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ badQuote: true }));
    const [warning] = await warningsOf(input.id);
    expect(warning).toMatchObject({ quoteStart: null, quoteEnd: null });
    expect((await testDb.conflictCheck.findFirstOrThrow({ where: { inputId: input.id } })).status).toBe("DONE");
  });

  it("원문에 있는 발췌는 구간으로 저장된다", async () => {
    const input = await submit(CONFLICT);
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector());
    const [warning] = await warningsOf(input.id);
    expect(CONFLICT.slice(warning.quoteStart!, warning.quoteEnd!)).toBe(CONFLICT);
  });

  it("같은 항목 중복과 6개 이상의 후보는 항목당 1개·최대 5개로 줄어든다", async () => {
    await seedSpecItems(w, ["환불은 7일 이내", "배송은 3일 이내", "포인트는 적립한다", "리뷰는 작성한다", "알림은 이메일로 보낸다"]);
    const input = await submit("아무 내용");
    await drainConflictChecks({ inputId: input.id }, new FakeConflictDetector({ flood: true }));
    const warnings = await warningsOf(input.id);
    expect(warnings.length).toBeLessThanOrEqual(5);
    expect(new Set(warnings.map((x) => x.itemKey)).size).toBe(warnings.length);
  });

  it("열려 있는 미결 질문이 AI 입력에 전달되고, 반영 대기 중인 승인 입력은 비교 대상에서 빠진다", async () => {
    await seedSpecItems(w, ["알림은 언제 보내나?"]); // 가짜 AI는 "?"로 끝나는 입력을 미결 질문으로 만든다
    await approvedInput(w, "승인되었지만 아직 반영되지 않은 입력"); // drain하지 않아 spec에 없음
    const input = await submit("쿠폰은 두 장까지 허용");
    const detector = new FakeConflictDetector();
    await drainConflictChecks({ inputId: input.id }, detector);
    const req = detector.calls[0];
    expect(req.openQuestions.map((q) => q.text)).toEqual(["알림은 언제 보내나?"]);
    expect(req.items.map((i) => i.text)).not.toContain("승인되었지만 아직 반영되지 않은 입력");
  });
});
