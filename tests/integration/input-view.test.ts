import { beforeEach, describe, expect, it } from "vitest";
import { listInputsView, rejectInput, submitInput } from "@/server/services/inputs";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const view = (user: World["admin"], opts: { filter?: string; limit?: number; cursor?: string } = {}) =>
  listInputsView(user, w.board.id, w.feature.id, opts);
const submit = (user: World["member"], content: string) =>
  submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content });

/** 멤버A 대기 1, 멤버B 대기 1, 승인(반영됨) 1, 승인(반영 대기) 1, 반려 1 */
async function seedMix() {
  const reflected = await approvedInput(w, "반영됨");
  await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  const waiting = await approvedInput(w, "반영 대기");
  const rejected = await submit(w.member, "반려될 입력");
  await rejectInput(w.admin, w.board.id, rejected.id, { reason: "범위 밖" });
  const minePending = await submit(w.member, "멤버A 대기");
  const otherPending = await submit(w.member2, "멤버B 대기");
  return { reflected, waiting, rejected, minePending, otherPending };
}

describe("입력 뷰: 필터와 개수 (시나리오 10)", () => {
  it("관리자는 전체를 보고 개수가 각 필터 결과와 일치한다", async () => {
    await seedMix();
    const all = await view(w.admin);
    expect(all.inputs).toHaveLength(5);
    expect(all.counts).toEqual({ all: 5, minePending: 0, reflectPending: 1, rejected: 1 });
    expect((await view(w.admin, { filter: "reflect-pending" })).inputs.map((i) => i.content)).toEqual(["반영 대기"]);
    expect((await view(w.admin, { filter: "rejected" })).inputs.map((i) => i.content)).toEqual(["반려될 입력"]);
  });

  it("멤버는 승인·반려 입력과 본인 대기 입력만 보고, 개수도 그 안에서 계산한다", async () => {
    await seedMix();
    const v = await view(w.member);
    expect(v.inputs.map((i) => i.content).sort()).toEqual(["멤버A 대기", "반영 대기", "반영됨", "반려될 입력"].sort());
    expect(v.counts).toEqual({ all: 4, minePending: 1, reflectPending: 1, rejected: 1 });
    expect((await view(w.member, { filter: "mine-pending" })).inputs.map((i) => i.content)).toEqual(["멤버A 대기"]);

    const other = await view(w.member2);
    expect(other.inputs.map((i) => i.content)).not.toContain("멤버A 대기");
    expect(other.counts.minePending).toBe(1);
  });

  it("열람자는 승인·반려 입력만 본다", async () => {
    await seedMix();
    const v = await view(w.viewer);
    expect(v.inputs.map((i) => i.content).sort()).toEqual(["반영 대기", "반영됨", "반려될 입력"].sort());
    expect(v.counts).toEqual({ all: 3, minePending: 0, reflectPending: 1, rejected: 1 });
    expect((await view(w.viewer, { filter: "mine-pending" })).inputs).toEqual([]);
  });

  it("입력에 번호, 반영된 버전 번호, 내 입력 여부가 들어 있다", async () => {
    const { reflected, waiting, minePending } = await seedMix();
    const v = await view(w.member);
    const byContent = Object.fromEntries(v.inputs.map((i) => [i.content, i]));
    expect(byContent["반영됨"]).toMatchObject({ number: reflected.number, reflectedVersion: 1, reflectedInSpec: true });
    expect(byContent["반영 대기"]).toMatchObject({ number: waiting.number, reflectedVersion: null, reflectedInSpec: false });
    expect(byContent["멤버A 대기"]).toMatchObject({ number: minePending.number, isMine: true });
    expect(byContent["반영됨"].isMine).toBe(true); // 멤버가 제출한 입력
  });
});

describe("입력 뷰: 페이징과 검증", () => {
  it("limit/cursor로 최신순 페이지를 나누고 마지막 페이지의 nextCursor는 null이다", async () => {
    for (const t of ["a", "b", "c", "d", "e"]) await submit(w.member, t);
    const p1 = await view(w.admin, { limit: 2 });
    expect(p1.inputs.map((i) => i.content)).toEqual(["e", "d"]);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await view(w.admin, { limit: 2, cursor: p1.nextCursor! });
    expect(p2.inputs.map((i) => i.content)).toEqual(["c", "b"]);
    const p3 = await view(w.admin, { limit: 2, cursor: p2.nextCursor! });
    expect(p3.inputs.map((i) => i.content)).toEqual(["a"]);
    expect(p3.nextCursor).toBeNull();
    expect(p1.counts.all).toBe(5);
  });

  it("잘못된 filter와 limit는 400", async () => {
    await expect(view(w.admin, { filter: "nope" })).rejects.toBeInstanceOf(ValidationError);
    await expect(view(w.admin, { limit: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(view(w.admin, { limit: 101 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("비멤버는 403", async () => {
    await expect(view(w.outsider)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
