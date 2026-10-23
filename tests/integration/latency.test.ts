import { beforeEach, expect, it } from "vitest";
import { approveInput, listInputs, submitInput } from "@/server/services/inputs";
import { resetDb, seedWorld, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];

it("제출·승인·목록 조회의 서버 처리 p95가 300ms 이내다 (plan.md 성능 목표)", async () => {
  const submit: number[] = [];
  const approve: number[] = [];
  const list: number[] = [];
  const ids: string[] = [];
  const time = async <T>(bucket: number[], fn: () => Promise<T>) => {
    const t = performance.now();
    const r = await fn();
    bucket.push(performance.now() - t);
    return r;
  };
  for (let i = 0; i < 60; i++) {
    const r = await time(submit, () => submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: `n${i}` }));
    ids.push(r.id);
  }
  for (const id of ids) await time(approve, () => approveInput(w.admin, w.board.id, id));
  for (let i = 0; i < 40; i++) await time(list, () => listInputs(w.admin, w.board.id, w.feature.id));
  for (const [name, xs] of [["submit", submit], ["approve", approve], ["list", list]] as const) {
    console.log(name, "p95(ms)=", p95(xs).toFixed(1));
    expect(p95(xs)).toBeLessThan(300);
  }
});
