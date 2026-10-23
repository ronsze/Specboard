import { beforeEach, describe, expect, it } from "vitest";
import { drainSpecJobs, retrySpecJob } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const lastJob = () => testDb.specJob.findFirstOrThrow({ orderBy: { createdAt: "desc" } });

describe("AI 실패 처리 (시나리오 8, 16)", () => {
  it("API 오류가 두 번 나도 세 번째 시도에서 성공하면 정상 반영된다", async () => {
    await approvedInput(w, "재시도 대상");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ failWith: "API_ERROR", failTimes: 2 }));
    expect(await versionsOf(w.feature.id)).toHaveLength(1);
    expect((await lastJob()).status).toBe("DONE");
  });

  it("계속 실패하면 3회 시도 뒤 FAILED, 기존 버전과 입력 상태는 불변이다", async () => {
    await approvedInput(w, "첫 입력");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const before = await versionsOf(w.feature.id);

    const failing = await approvedInput(w, "실패할 입력");
    const writer = new FakeSpecWriter({ failWith: "TIMEOUT" });
    await drainSpecJobs(w.feature.id, writer);

    expect(writer.calls).toHaveLength(3);
    expect(await lastJob()).toMatchObject({ status: "FAILED", lastError: "TIMEOUT", attempts: 3 });
    expect(await versionsOf(w.feature.id)).toHaveLength(before.length);
    const stored = await testDb.input.findUniqueOrThrow({ where: { id: failing.id } });
    expect(stored).toMatchObject({ status: "APPROVED", consumedAt: null });
  });

  it("출처 없는 출력은 저장되지 않고 INVALID_OUTPUT으로 실패한다", async () => {
    await approvedInput(w, "입력");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ invalidOutput: true }));
    expect(await versionsOf(w.feature.id)).toHaveLength(0);
    expect(await lastJob()).toMatchObject({ status: "FAILED", lastError: "INVALID_OUTPUT" });
  });

  it("거절(REFUSED)은 재시도 없이 바로 FAILED가 된다", async () => {
    await approvedInput(w, "입력");
    const writer = new FakeSpecWriter({ failWith: "REFUSED" });
    await drainSpecJobs(w.feature.id, writer);
    expect(writer.calls).toHaveLength(1);
    expect(await lastJob()).toMatchObject({ status: "FAILED", lastError: "REFUSED" });
  });

  it("관리자가 재시도하면 새 작업이 등록되고 성공하면 반영된다", async () => {
    await approvedInput(w, "입력");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ failWith: "API_ERROR" }));
    await retrySpecJob(w.admin, w.board.id, w.feature.id);
    expect((await lastJob()).status).toBe("QUEUED");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect(await versionsOf(w.feature.id)).toHaveLength(1);
  });

  it("재시도는 관리자만, 실패한 작업이 있을 때만 가능하다", async () => {
    await approvedInput(w, "입력");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ failWith: "API_ERROR" }));
    await expect(retrySpecJob(w.member, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ForbiddenError);
    await retrySpecJob(w.admin, w.board.id, w.feature.id);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    await expect(retrySpecJob(w.admin, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ConflictError);
  });
});
