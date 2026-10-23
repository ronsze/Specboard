import { beforeEach, describe, expect, it } from "vitest";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const run = () => drainSpecJobs(w.feature.id, new FakeSpecWriter());
const spec = () => getSpec(w.viewer, w.board.id, w.feature.id);

describe("미결 질문 해소 (시나리오 7)", () => {
  it("답이 승인되면 질문이 해소되고 답이 항목으로 반영되며 출처가 연결된다", async () => {
    await approvedInput(w, "알림은 언제 보내야 하나?");
    await run();
    const answer = await approvedInput(w, "답: 승인 즉시 보낸다");
    await run();

    const { version } = await spec();
    expect(version!.number).toBe(2);
    expect(version!.questions[0]).toMatchObject({ status: "RESOLVED" });
    expect(version!.questions[0].resolvedBy?.inputId).toBe(answer.id);
    expect(version!.questions[0].sources.map((s) => s.inputId)).toContain(answer.id);

    expect(version!.items.map((i) => i.text)).toEqual(["답: 승인 즉시 보낸다"]);
    expect(version!.items[0].sources.map((s) => s.inputId)).toEqual([answer.id]);
  });

  it("답이 없는 입력으로는 질문이 열린 상태로 남는다", async () => {
    await approvedInput(w, "알림은 언제 보내야 하나?");
    await run();
    await approvedInput(w, "로그인 화면은 간결하게");
    await run();

    const { version } = await spec();
    expect(version!.questions[0].status).toBe("OPEN");
    expect(version!.questions[0].resolvedBy).toBeNull();
  });

  it("이전 버전에는 해소 전 상태가 그대로 남는다", async () => {
    await approvedInput(w, "알림은 언제 보내야 하나?");
    await run();
    await approvedInput(w, "답: 즉시");
    await run();
    const [v1, v2] = await versionsOf(w.feature.id);
    expect(v1.questions[0].status).toBe("OPEN");
    expect(v2.questions[0].status).toBe("RESOLVED");
    expect(v1.questions[0].key).toBe(v2.questions[0].key);
  });
});
