import { beforeEach, describe, expect, it } from "vitest";
import {
  diff,
  finalizeSpec,
  getSpec,
  getVersion,
  listVersions,
  revertSpec,
  unfinalizeSpec,
} from "@/server/services/spec";
import { drainSpecJobs, retrySpecJob } from "@/server/services/spec-jobs";
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

const readers: [string, (u: Actor) => Promise<unknown>][] = [
  ["getSpec", (u) => getSpec(u, b(), f())],
  ["listVersions", (u) => listVersions(u, b(), f())],
  ["getVersion", (u) => getVersion(u, b(), f(), 1)],
  ["diff", (u) => diff(u, b(), f(), 1, 2)],
];

const adminOnly: [string, (u: Actor) => Promise<unknown>][] = [
  ["revertSpec", (u) => revertSpec(u, b(), f(), 1)],
  ["finalizeSpec", (u) => finalizeSpec(u, b(), f())],
  ["unfinalizeSpec", (u) => unfinalizeSpec(u, b(), f())],
  ["retrySpecJob", (u) => retrySpecJob(u, b(), f())],
];

describe("spec 권한 매트릭스 (시나리오 12, 19)", () => {
  it.each(readers)("%s: 관리자·멤버·열람자는 열람하고 비멤버는 403", async (_name, call) => {
    for (const user of [w.admin, w.member, w.viewer]) await expect(call(user)).resolves.toBeTruthy();
    await expect(call(w.outsider)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(adminOnly)("%s: 멤버·열람자·비멤버는 403 (상태 검사보다 권한 검사가 먼저)", async (_name, call) => {
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(call(user)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});
