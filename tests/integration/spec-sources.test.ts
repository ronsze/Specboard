import { beforeEach, describe, expect, it } from "vitest";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const run = () => drainSpecJobs(w.feature.id, new FakeSpecWriter());
const spec = () => getSpec(w.viewer, w.board.id, w.feature.id);

describe("출처 열람 (시나리오 5)", () => {
  it("항목의 출처로 종류·제출자·시각·내용을 볼 수 있고 모든 항목에 출처가 있다", async () => {
    const a = await approvedInput(w, "결제는 카드만 지원한다");
    await approvedInput(w, "환불은 7일 이내");
    await run();

    const { version } = await spec();
    expect(version!.items).toHaveLength(2);
    for (const item of version!.items) expect(item.sources.length).toBeGreaterThanOrEqual(1);

    const first = version!.items.find((i) => i.text === "결제는 카드만 지원한다")!;
    expect(first.sources[0]).toMatchObject({
      inputId: a.id,
      kind: "IDEA",
      submitterName: "멤버",
      content: "결제는 카드만 지원한다",
    });
    expect(new Date(first.sources[0].submittedAt).getTime()).toBeGreaterThan(0);
  });
});

describe("지어내지 않기 (시나리오 6)", () => {
  it("정보가 부족한 입력은 항목 대신 미결 질문으로 남고 질문에도 출처가 있다", async () => {
    const q = await approvedInput(w, "알림은 언제 보내야 하나?");
    await run();

    const { version } = await spec();
    expect(version!.items).toHaveLength(0);
    expect(version!.questions).toHaveLength(1);
    expect(version!.questions[0]).toMatchObject({ status: "OPEN", resolvedBy: null });
    expect(version!.questions[0].sources.map((s) => s.inputId)).toEqual([q.id]);
  });
});
