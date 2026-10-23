import { beforeEach, expect, it } from "vitest";
import { getHome } from "@/server/services/home";
import { listBoardPending } from "@/server/services/board-pending";
import { listInputsView } from "@/server/services/inputs";
import { previewRevert } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { approvedInput } from "./helpers/spec";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  // feature 20개, 입력 1,000개(대기 포함)를 직접 만든다
  const project = await testDb.project.findFirstOrThrow({ where: { boardId: w.board.id } });
  const features = [w.feature];
  for (let i = 0; i < 19; i++) features.push(await testDb.feature.create({ data: { projectId: project.id, name: `F${i}` } }));
  await testDb.input.createMany({
    data: Array.from({ length: 1000 }, (_, i) => ({
      boardId: w.board.id,
      number: i + 1,
      featureId: features[i % 20].id,
      kind: "IDEA" as const,
      content: `입력 ${i}`,
      submittedBy: w.member.id,
      submitterName: "멤버",
      status: i % 3 === 0 ? ("PENDING" as const) : ("APPROVED" as const),
    })),
  });
  await testDb.board.update({ where: { id: w.board.id }, data: { inputSeq: 1000 } });
  // 비교·미리보기용으로 버전 몇 개
  for (const t of ["A", "B", "C"]) {
    await approvedInput(w, t);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
}, 120_000);

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];

it("홈 요약·보드 승인 대기·입력 뷰·되돌리기 미리보기의 p95가 300ms 이내다 (plan.md 성능 목표)", async () => {
  const calls: Record<string, () => Promise<unknown>> = {
    getHome: () => getHome(w.admin),
    listBoardPending: () => listBoardPending(w.admin, w.board.id),
    listInputsView: () => listInputsView(w.admin, w.board.id, w.feature.id, { limit: 20 }),
    previewRevert: () => previewRevert(w.admin, w.board.id, w.feature.id, 1),
  };
  for (const [name, call] of Object.entries(calls)) {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await call();
      times.push(performance.now() - t);
    }
    expect(p95(times), `${name} p95`).toBeLessThan(300);
  }
}, 120_000);
