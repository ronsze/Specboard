import { beforeEach, describe, expect, it } from "vitest";
import { diff, getVersion, listVersions } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
let ids: string[];
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  ids = [];
  for (const text of ["첫 번째", "두 번째"]) {
    ids.push((await approvedInput(w, text)).id);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
});

describe("버전 이력과 비교 (시나리오 9, 19)", () => {
  it("최신순 목록에 번호·생성 시각·생성 방식·근거 입력이 있다", async () => {
    const list = await listVersions(w.viewer, w.board.id, w.feature.id);
    expect(list.map((v) => v.number)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ kind: "AI_UPDATE", inputIds: [ids[1]] });
    expect(list[1].inputIds).toEqual([ids[0]]);
    expect(new Date(list[0].createdAt).getTime()).toBeGreaterThan(0);
  });

  it("버전 상세는 그 시점의 항목을 보여준다", async () => {
    const v1 = await getVersion(w.member, w.board.id, w.feature.id, 1);
    expect(v1.items.map((i) => i.text)).toEqual(["첫 번째"]);
    const v2 = await getVersion(w.member, w.board.id, w.feature.id, 2);
    expect(v2.items.map((i) => i.text)).toEqual(["첫 번째", "두 번째"]);
  });

  it("두 버전을 비교하면 추가된 항목이 보인다", async () => {
    const d = await diff(w.admin, w.board.id, w.feature.id, 1, 2);
    expect(d).toMatchObject({ from: 1, to: 2 });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ change: "ADDED", after: "두 번째" });
  });

  it("없는 버전은 404", async () => {
    await expect(getVersion(w.admin, w.board.id, w.feature.id, 99)).rejects.toBeInstanceOf(NotFoundError);
    await expect(diff(w.admin, w.board.id, w.feature.id, 1, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("전 역할이 열람하고 비멤버는 403", async () => {
    for (const user of [w.admin, w.member, w.viewer]) {
      await expect(listVersions(user, w.board.id, w.feature.id)).resolves.toHaveLength(2);
    }
    await expect(listVersions(w.outsider, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getVersion(w.outsider, w.board.id, w.feature.id, 1)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(diff(w.outsider, w.board.id, w.feature.id, 1, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
