import { beforeEach, describe, expect, it } from "vitest";
import { diff, revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ValidationError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const add = async (text: string) => {
  const input = await approvedInput(w, text);
  await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  return input;
};
const compare = (from: number, to: number) => diff(w.viewer, w.board.id, w.feature.id, from, to);

describe("비교 확장 (시나리오 18)", () => {
  it("요약, 라벨, 새 출처(IN-n)가 나오고 동일 항목은 unchanged에 담긴다", async () => {
    await add("A");
    const b = await add("B");
    const d = await compare(1, 2);
    expect(d.summary).toEqual({ added: 1, removed: 0, changed: 0, unchanged: 1 });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ change: "ADDED", scope: "ITEM", label: "R-2", kind: "REQUIREMENT", after: "B" });
    expect(d.items[0].addedSources.map((s) => s.number)).toEqual([b.number]);
    expect(d.unchanged.map((u) => u.label)).toEqual(["R-1"]);
  });

  it("같은 버전끼리의 비교는 400", async () => {
    await add("A");
    await expect(compare(1, 1)).rejects.toBeInstanceOf(ValidationError);
  });

  it("번호가 다르지만 내용이 같은 두 버전은 변경 0건과 동일 개수만 돌려준다", async () => {
    await add("A");
    await add("B");
    await revertSpec(w.admin, w.board.id, w.feature.id, 1); // v3 = v1과 같은 내용
    const d = await compare(1, 3);
    expect(d.items).toEqual([]);
    expect(d.questions).toEqual([]);
    expect(d.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1 });
  });

  it("되돌리기로 사라진 항목은 REMOVED로 나온다", async () => {
    await add("A");
    await add("B");
    await revertSpec(w.admin, w.board.id, w.feature.id, 1);
    const d = await compare(2, 3);
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ change: "REMOVED", label: "R-2", before: "B", after: null });
    expect(d.summary.removed).toBe(1);
  });

  it("질문이 해소되면 질문 변경(열림→해소)과 새 항목이 함께 나온다", async () => {
    await add("언제 보내나?");
    await add("답: 즉시");
    const d = await compare(1, 2);
    expect(d.questions).toHaveLength(1);
    expect(d.questions[0]).toMatchObject({ change: "CHANGED", scope: "QUESTION", label: "Q-1" });
    expect(d.questions[0].before).toContain("열림");
    expect(d.questions[0].after).toContain("해소");
    expect(d.items[0]).toMatchObject({ change: "ADDED", label: "D-1", kind: "DECISION" });
  });
});
