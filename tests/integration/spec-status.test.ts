import { beforeEach, describe, expect, it } from "vitest";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const spec = (user = w.viewer) => getSpec(user, w.board.id, w.feature.id);

describe("spec 상태 (시나리오 17, 18)", () => {
  it("승인된 입력이 없으면 NONE과 안내 문구", async () => {
    expect(await spec()).toMatchObject({ status: "NONE", message: "승인된 입력이 아직 없습니다.", version: null });
  });

  it("작업이 있으면 UPDATING, 끝나면 IDLE", async () => {
    await approvedInput(w, "내용");
    expect(await spec()).toMatchObject({ status: "UPDATING", pendingInputCount: 1 });
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const done = await spec();
    expect(done.status).toBe("IDLE");
    expect(done.pendingInputCount).toBe(0);
    expect(done.version?.number).toBe(1);
  });

  it("실패하면 FAILED와 안내, 기존 내용은 계속 보인다", async () => {
    await approvedInput(w, "첫 내용");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    await approvedInput(w, "실패할 내용");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ failWith: "REFUSED" }));
    const failed = await spec();
    expect(failed.status).toBe("FAILED");
    expect(failed.message).toContain("다시 시도");
    expect(failed.version?.items.map((i) => i.text)).toEqual(["첫 내용"]);
    expect(failed.pendingInputCount).toBe(1);
  });

  it("작업이 멈춘 채 임대가 만료되면 되살려 다시 처리할 수 있다", async () => {
    await approvedInput(w, "내용");
    await testDb.specJob.updateMany({ data: { status: "RUNNING", leaseUntil: new Date(Date.now() - 1000) } });
    expect((await spec()).status).toBe("UPDATING");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect((await spec()).status).toBe("IDLE");
  });

  it("전 역할이 열람할 수 있고 비멤버는 거부된다", async () => {
    for (const user of [w.admin, w.member, w.viewer]) await expect(spec(user)).resolves.toBeTruthy();
    await expect(spec(w.outsider)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
