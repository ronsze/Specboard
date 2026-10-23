import { beforeEach, describe, expect, it } from "vitest";
import { revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const run = () => drainSpecJobs(w.feature.id, new FakeSpecWriter());
const add = async (text: string) => {
  await approvedInput(w, text);
  await run();
};
const numbersOf = (v: Awaited<ReturnType<typeof versionsOf>>[number]) =>
  v.items.map((i) => `${i.kind === "DECISION" ? "D" : "R"}-${i.number}:${i.text}`);

describe("항목·질문 안정 번호", () => {
  it("결정·요구사항이 종류별로 1부터 증가하고 질문도 1부터 증가한다", async () => {
    await add("요구 하나");
    await add("답: 결정 하나"); // 결정으로 만들어진다 (가짜 AI 규칙)
    await add("요구 둘");
    await add("첫 질문?");
    await add("둘째 질문?");

    const last = (await versionsOf(w.feature.id)).at(-1)!;
    expect(numbersOf(last)).toEqual(["R-1:요구 하나", "D-1:답: 결정 하나", "R-2:요구 둘"]);
    expect(last.questions.map((q) => q.number)).toEqual([1, 2]);
  });

  it("새 버전에서도 같은 key는 같은 번호를 유지하고 카운터는 최댓값과 같다", async () => {
    await add("A");
    await add("B");
    await add("C");
    const versions = await versionsOf(w.feature.id);
    for (const v of versions) {
      for (const item of v.items) {
        const final = versions.at(-1)!.items.find((i) => i.key === item.key)!;
        expect(item.number).toBe(final.number);
      }
    }
    const spec = await testDb.spec.findFirstOrThrow();
    expect(spec.requirementSeq).toBe(3);
    expect(spec.decisionSeq).toBe(0);
  });

  it("질문이 해소되어도 번호는 유지된다", async () => {
    await add("언제 보내나?");
    await add("답: 즉시");
    const [v1, v2] = await versionsOf(w.feature.id);
    expect(v1.questions[0].number).toBe(v2.questions[0].number);
    expect(v2.questions[0].status).toBe("RESOLVED");
  });

  it("되돌리기 후에도 번호가 유지되고, 이후 새 항목은 재사용 없이 이어서 부여된다", async () => {
    await add("A");
    await add("B");
    await add("C");
    await revertSpec(w.admin, w.board.id, w.feature.id, 1); // A만 남는다 (B=R-2, C=R-3 삭제)
    await add("D");
    const last = (await versionsOf(w.feature.id)).at(-1)!;
    expect(numbersOf(last)).toEqual(["R-1:A", "R-4:D"]);
  });

  it("같은 spec의 같은 종류에서 번호가 중복되지 않는다", async () => {
    for (const t of ["A", "B", "C", "D"]) await add(t);
    const last = (await versionsOf(w.feature.id)).at(-1)!;
    const nums = last.items.map((i) => i.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
