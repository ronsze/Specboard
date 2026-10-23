import { beforeEach, describe, expect, it } from "vitest";
import { getSpec, revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
let inputIds: string[];
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  inputIds = [];
  for (const text of ["첫 번째", "두 번째", "세 번째"]) {
    inputIds.push((await approvedInput(w, text)).id);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
});

const revert = (to: number, user = w.admin) => revertSpec(user, w.board.id, w.feature.id, to);

describe("되돌리기 (시나리오 10~12)", () => {
  it("선택한 버전과 같은 내용의 새 버전이 생기고 기존 버전은 모두 보존된다", async () => {
    const before = await versionsOf(w.feature.id);
    const created = await revert(1);

    expect(created).toMatchObject({ number: 4, kind: "REVERT", revertedFromNumber: 1, createdByName: "관리자" });
    const after = await versionsOf(w.feature.id);
    expect(after).toHaveLength(4);
    for (let i = 0; i < 3; i++) {
      expect(after[i].items.map((x) => [x.key, x.text])).toEqual(before[i].items.map((x) => [x.key, x.text]));
    }
    expect(after[3].items.map((x) => [x.key, x.text])).toEqual(after[0].items.map((x) => [x.key, x.text]));
    expect(after[3].items[0].sources.map((s) => s.inputId)).toEqual([inputIds[0]]);
    expect(after[3].inputs).toHaveLength(0);
    expect((await getSpec(w.viewer, w.board.id, w.feature.id)).version?.number).toBe(4);
  });

  it("되돌려도 입력의 반영 표시는 바뀌지 않고 재반영도 일어나지 않는다", async () => {
    await revert(1);
    expect(await testDb.input.count({ where: { consumedAt: null, status: "APPROVED" } })).toBe(0);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect(await versionsOf(w.feature.id)).toHaveLength(4);
    expect(await testDb.specJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } })).toBe(0);
  });

  it("되돌린 뒤 새 입력은 되돌려진 내용 위에 반영된다", async () => {
    await revert(1);
    await approvedInput(w, "네 번째");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const latest = (await versionsOf(w.feature.id)).at(-1)!;
    expect(latest.number).toBe(5);
    expect(latest.items.map((i) => i.text)).toEqual(["첫 번째", "네 번째"]);
  });

  it("최신 버전과 같은 내용으로의 되돌리기는 새 버전 없이 거부한다", async () => {
    await expect(revert(3)).rejects.toBeInstanceOf(ConflictError);
    await revert(1);
    await expect(revert(1)).rejects.toBeInstanceOf(ConflictError);
    expect(await versionsOf(w.feature.id)).toHaveLength(4);
  });

  it("관리자만 되돌릴 수 있다", async () => {
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(revert(1, user)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await versionsOf(w.feature.id)).toHaveLength(3);
  });

  it("없는 버전과 잘못된 번호", async () => {
    await expect(revert(99)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revert(0)).rejects.toMatchObject({ status: 400 });
    await expect(revert(1.5)).rejects.toMatchObject({ status: 400 });
  });
});
