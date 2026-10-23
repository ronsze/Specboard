import { beforeEach, describe, expect, it } from "vitest";
import { getHome } from "@/server/services/home";
import { countBoardPending, listBoardPending } from "@/server/services/board-pending";
import { listInputsView } from "@/server/services/inputs";
import { previewRevert } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  for (const t of ["A", "B"]) {
    await approvedInput(w, t);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
});

type Actor = World["admin"];
const b = () => w.board.id;
const f = () => w.feature.id;

const anyMember: [string, (u: Actor) => Promise<unknown>][] = [
  ["listInputsView", (u) => listInputsView(u, b(), f())],
];
const adminOnly: [string, (u: Actor) => Promise<unknown>][] = [
  ["listBoardPending", (u) => listBoardPending(u, b())],
  ["countBoardPending", (u) => countBoardPending(u, b())],
  ["previewRevert", (u) => previewRevert(u, b(), f(), 1)],
];

describe("003 새 서비스의 권한 매트릭스 (FR-007, SC-008)", () => {
  it.each(anyMember)("%s: 관리자·멤버·열람자는 가능, 비멤버는 403", async (_n, call) => {
    for (const user of [w.admin, w.member, w.viewer]) await expect(call(user)).resolves.toBeTruthy();
    await expect(call(w.outsider)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(adminOnly)("%s: 관리자만 가능, 멤버·열람자·비멤버는 403", async (_n, call) => {
    await expect(call(w.admin)).resolves.not.toBeUndefined();
    for (const user of [w.member, w.viewer, w.outsider]) await expect(call(user)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("getHome은 본인이 속한 보드만 돌려주고 비멤버는 빈 목록이다", async () => {
    expect((await getHome(w.outsider)).boards).toEqual([]);
    for (const user of [w.admin, w.member, w.viewer]) {
      expect((await getHome(user)).boards.map((x) => x.id)).toEqual([b()]);
    }
  });
});
