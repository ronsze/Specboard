import { beforeEach, describe, expect, it } from "vitest";
import { finalizeSpec, getSpec, revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const run = (opts = {}) => drainSpecJobs(w.feature.id, new FakeSpecWriter(opts));
const add = async (text: string) => {
  const input = await approvedInput(w, text);
  await run();
  return input;
};
const spec = () => getSpec(w.viewer, w.board.id, w.feature.id);

describe("getSpec 확장 (시나리오 3~5, 17)", () => {
  it("항목에 번호 라벨, 처음 생긴 버전, 변경 표시가 붙는다", async () => {
    await add("요구 하나");
    await add("답: 결정 하나");
    await add("요구 둘");

    const { version } = await spec();
    expect(version!.items.map((i) => [i.label, i.text, i.firstVersion, i.change])).toEqual([
      ["R-1", "요구 하나", 1, "NONE"],
      ["D-1", "답: 결정 하나", 2, "NONE"],
      ["R-2", "요구 둘", 3, "ADDED"],
    ]);
    expect(version!.items.every((i) => i.lastChangedVersion >= i.firstVersion)).toBe(true);
  });

  it("출처에 입력 번호(IN-n)와 승인 상태가 있다", async () => {
    const a = await add("첫 입력");
    const { version } = await spec();
    expect(version!.items[0].sources[0]).toMatchObject({ inputId: a.id, number: a.number, status: "APPROVED", quote: null });
  });

  it("질문에 번호·라벨과 해소 버전이 붙고 counts가 집계된다", async () => {
    await add("요구 하나");
    await add("언제 보내나?");
    await add("무엇을 보내나?");
    await add("답: 즉시 보낸다"); // 열린 질문을 모두 해소하고 결정 항목 추가

    const { version } = await spec();
    expect(version!.questions.map((q) => [q.label, q.status, q.resolvedInVersion])).toEqual([
      ["Q-1", "RESOLVED", 4],
      ["Q-2", "RESOLVED", 4],
    ]);
    expect(version!.counts).toEqual({ decisions: 1, requirements: 1, openQuestions: 0, resolvedQuestions: 2 });
    expect(version!.questions[0].resolvedBy?.number).toBeGreaterThan(0);
  });

  it("최근 버전은 최대 3개이고 현재 버전이 표시된다", async () => {
    for (const t of ["A", "B", "C", "D", "E"]) await add(t);
    const { recentVersions } = await spec();
    expect(recentVersions.map((v) => v.number)).toEqual([5, 4, 3]);
    expect(recentVersions.map((v) => v.isCurrent)).toEqual([true, false, false]);
  });

  it("되돌림 버전은 표시와 변경 버전 계산에 반영된다", async () => {
    await add("A");
    await add("B");
    await revertSpec(w.admin, w.board.id, w.feature.id, 1);
    const { version, recentVersions } = await spec();
    expect(version!.number).toBe(3);
    expect(recentVersions[0]).toMatchObject({ kind: "REVERT", revertedFromNumber: 1, createdByName: "관리자" });
    expect(version!.items.map((i) => i.label)).toEqual(["R-1"]);
  });

  it("갱신 중에는 읽는 입력 수(progress)가 나온다", async () => {
    await approvedInput(w, "A");
    await approvedInput(w, "B");
    const view = await spec();
    expect(view.status).toBe("UPDATING");
    expect(view.progress).toEqual({ inputCount: 2 });
  });

  it("실패하면 시도 횟수·시각·코드·다음 버전 번호가 나오고 마지막 성공 버전은 그대로 보인다", async () => {
    await add("첫 입력");
    await approvedInput(w, "실패할 입력");
    await run({ failWith: "TIMEOUT" });
    const view = await spec();
    expect(view.status).toBe("FAILED");
    expect(view.failure).toMatchObject({ attempts: 3, code: "TIMEOUT", nextVersion: 2 });
    expect(new Date(view.failure!.at).getTime()).toBeGreaterThan(0);
    expect(view.version!.number).toBe(1);
    expect(view.message).toContain("입력");
  });

  it("확정 상태의 안내에는 해제 시 반영될 대기 입력 수가 들어간다", async () => {
    await add("A");
    await finalizeSpec(w.admin, w.board.id, w.feature.id);
    await approvedInput(w, "B");
    await approvedInput(w, "C");
    const view = await spec();
    expect(view.status).toBe("FINALIZED");
    expect(view.message).toContain("2개");
    expect(view.progress).toBeNull();
    expect(view.failure).toBeNull();
  });

  it("승인된 입력이 없으면 NONE, version·recentVersions는 비어 있다", async () => {
    const view = await spec();
    expect(view).toMatchObject({ status: "NONE", version: null, recentVersions: [], progress: null, failure: null });
  });
});
