import { beforeEach, describe, expect, it } from "vitest";
import { finalizeSpec, getSpec, revertSpec, unfinalizeSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { listInputs } from "@/server/services/inputs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const run = () => drainSpecJobs(w.feature.id, new FakeSpecWriter());
const finalize = (user = w.admin) => finalizeSpec(user, w.board.id, w.feature.id);
const unfinalize = (user = w.admin) => unfinalizeSpec(user, w.board.id, w.feature.id);
const seedVersion = async (text = "첫 번째") => {
  await approvedInput(w, text);
  await run();
};

describe("확정과 해제 (시나리오 13~15)", () => {
  it("확정하면 FINALIZED가 되고 수행자·시각이 기록된다", async () => {
    await seedVersion();
    const view = await finalize();
    expect(view.status).toBe("FINALIZED");
    expect(view.finalizedByName).toBe("관리자");
    expect(new Date(view.finalizedAt!).getTime()).toBeGreaterThan(0);
  });

  it("확정 중에 승인된 입력은 새 버전 없이 반영 대기로 남는다", async () => {
    await seedVersion();
    await finalize();
    const pending = await approvedInput(w, "확정 후 입력");
    await run();

    expect(await versionsOf(w.feature.id)).toHaveLength(1);
    expect(await testDb.specJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(0);
    const view = await getSpec(w.viewer, w.board.id, w.feature.id);
    expect(view).toMatchObject({ status: "FINALIZED", pendingInputCount: 1 });
    expect(view.message).toContain("1개");
    const listed = (await listInputs(w.admin, w.board.id, w.feature.id)).find((i) => i.id === pending.id);
    expect(listed).toMatchObject({ status: "APPROVED", reflectedInSpec: false });
  });

  it("확정 중에는 되돌리기가 거부된다", async () => {
    await seedVersion("A");
    await seedVersion("B");
    await finalize();
    await expect(revertSpec(w.admin, w.board.id, w.feature.id, 1)).rejects.toBeInstanceOf(ConflictError);
    expect(await versionsOf(w.feature.id)).toHaveLength(2);
  });

  it("해제하면 쌓인 입력이 승인 순서대로 한 번의 갱신으로 반영된다", async () => {
    await seedVersion();
    await finalize();
    await approvedInput(w, "둘째");
    await approvedInput(w, "셋째");
    await run();
    expect(await versionsOf(w.feature.id)).toHaveLength(1);

    const view = await unfinalize();
    expect(view.status).toBe("UPDATING");
    const writer = new FakeSpecWriter();
    await drainSpecJobs(w.feature.id, writer);

    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0].inputs.map((i) => i.content)).toEqual(["둘째", "셋째"]);
    const versions = await versionsOf(w.feature.id);
    expect(versions).toHaveLength(2);
    expect(versions[1].items.map((i) => i.text)).toEqual(["첫 번째", "둘째", "셋째"]);
    expect((await getSpec(w.viewer, w.board.id, w.feature.id)).status).toBe("IDLE");
  });

  it("대기 입력이 없으면 해제해도 새 버전도 작업도 없다", async () => {
    await seedVersion();
    await finalize();
    const view = await unfinalize();
    expect(view.status).toBe("IDLE");
    await run();
    expect(await versionsOf(w.feature.id)).toHaveLength(1);
  });

  it("해제 후에는 되돌리기가 다시 가능하다", async () => {
    await seedVersion("A");
    await seedVersion("B");
    await finalize();
    await unfinalize();
    await expect(revertSpec(w.admin, w.board.id, w.feature.id, 1)).resolves.toMatchObject({ number: 3 });
  });

  it("관리자만 확정·해제할 수 있다", async () => {
    await seedVersion();
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(finalize(user)).rejects.toBeInstanceOf(ForbiddenError);
    }
    await finalize();
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(unfinalize(user)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("버전이 없거나 이미 확정된 spec은 확정할 수 없고, 확정이 아니면 해제할 수 없다", async () => {
    await expect(finalize()).rejects.toBeInstanceOf(ConflictError);
    await seedVersion();
    await expect(unfinalize()).rejects.toBeInstanceOf(ConflictError);
    await finalize();
    await expect(finalize()).rejects.toBeInstanceOf(ConflictError);
  });
});
