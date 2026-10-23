import { PrismaClient } from "@prisma/client";
import { beforeEach, expect, it } from "vitest";
import { listBoardPending } from "@/server/services/board-pending";
import { listInputsView } from "@/server/services/inputs";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  // 대기 입력 200개, 각각 DONE 검사와 경고 1~2개
  await testDb.input.createMany({
    data: Array.from({ length: 200 }, (_, i) => ({
      boardId: w.board.id,
      number: i + 1,
      featureId: w.feature.id,
      kind: "IDEA" as const,
      content: `쿠폰은 두 장까지 허용하자 ${i}`,
      submittedBy: w.member.id,
      submitterName: "멤버",
    })),
  });
  await testDb.board.update({ where: { id: w.board.id }, data: { inputSeq: 200 } });
  const inputs = await testDb.input.findMany({ where: { boardId: w.board.id } });
  await testDb.conflictCheck.createMany({
    data: inputs.map((i) => ({ inputId: i.id, boardId: w.board.id, featureId: w.feature.id, status: "DONE" as const, baseVersionNumber: 1, completedAt: new Date() })),
  });
  const checks = await testDb.conflictCheck.findMany({ where: { boardId: w.board.id } });
  await testDb.conflictWarning.createMany({
    data: checks.flatMap((c, n) =>
      [0, 1].slice(0, (n % 2) + 1).map((k) => ({
        checkId: c.id,
        inputId: c.inputId,
        itemKey: `key-${k}`,
        itemKind: "REQUIREMENT" as const,
        itemNumber: k + 1,
        itemText: "쿠폰은 한 장만",
        onFinalizedSpec: k === 0,
        reason: "어긋날 수 있다",
      })),
    ),
  });
}, 120_000);

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];

it("경고가 붙은 입력 200개의 관리자 조회 p95가 300ms 이내이고 쿼리 수가 입력 수에 비례하지 않는다", async () => {
  const calls: Record<string, () => Promise<unknown>> = {
    listBoardPending: () => listBoardPending(w.admin, w.board.id),
    listInputsView: () => listInputsView(w.admin, w.board.id, w.feature.id, { limit: 100 }),
  };
  for (const [name, call] of Object.entries(calls)) {
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t = performance.now();
      await call();
      times.push(performance.now() - t);
    }
    expect(p95(times), `${name} p95`).toBeLessThan(300);
  }
  // 쿼리 수: 입력 수(200 vs 10)에 상관없이 일정
  const queries: string[] = [];
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  client.$on("query", (e: { query: string }) => queries.push(e.query));
  try {
    const { loadConflictViews } = await import("@/server/services/conflict-view");
    const all = await testDb.input.findMany({ where: { boardId: w.board.id }, select: { id: true, featureId: true, status: true } });
    queries.length = 0;
    await loadConflictViews(all.slice(0, 10), client);
    const small = queries.length;
    queries.length = 0;
    await loadConflictViews(all, client);
    expect(queries.length).toBe(small);
  } finally {
    await client.$disconnect();
  }
}, 120_000);
