import { beforeEach, expect, it } from "vitest";
import { diff, getSpec, listVersions } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  for (let i = 0; i < 30; i++) {
    await approvedInput(w, `입력 ${i}`);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
});

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];

it("열람 서비스(getSpec, listVersions, diff)의 p95가 300ms 이내다 (plan.md 성능 목표)", async () => {
  const calls = {
    getSpec: () => getSpec(w.viewer, w.board.id, w.feature.id),
    listVersions: () => listVersions(w.viewer, w.board.id, w.feature.id),
    diff: () => diff(w.viewer, w.board.id, w.feature.id, 1, 30),
  };
  for (const [name, call] of Object.entries(calls)) {
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t = performance.now();
      await call();
      times.push(performance.now() - t);
    }
    console.log(`${name} p95(ms)=${p95(times).toFixed(1)}`);
    expect(p95(times)).toBeLessThan(300);
  }
});
