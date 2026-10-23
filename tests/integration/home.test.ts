import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { getHome } from "@/server/services/home";
import { getSpec, finalizeSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { submitInput } from "@/server/services/inputs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

async function newFeature(name: string, boardId = w.board.id) {
  let project = await testDb.project.findFirst({ where: { boardId } });
  project ??= await testDb.project.create({ data: { boardId, name: "P" } });
  return testDb.feature.create({ data: { projectId: project.id, name } });
}
const findFeature = (home: Awaited<ReturnType<typeof getHome>>, id: string) =>
  home.boards.flatMap((b) => b.projects).flatMap((p) => p.features).find((f) => f.id === id)!;

describe("홈 요약 (시나리오 16)", () => {
  it("feature별 상태·최신 버전·날짜·반영 대기 수를 보여준다", async () => {
    const none = await newFeature("없음");
    const idle = await newFeature("최신");
    const updating = await newFeature("갱신 중");
    const failed = await newFeature("실패");
    const finalized = await newFeature("확정");

    const writer = () => new FakeSpecWriter();
    const approveIn = async (featureId: string, text: string) => {
      const i = await submitInput(w.admin, w.board.id, featureId, { kind: "IDEA", content: text }); // 자동 승인
      return i;
    };
    await approveIn(idle.id, "A");
    await drainSpecJobs(idle.id, writer());
    await approveIn(finalized.id, "B");
    await drainSpecJobs(finalized.id, writer());
    await finalizeSpec(w.admin, w.board.id, finalized.id);
    await approveIn(finalized.id, "확정 후"); // 반영 대기
    await approveIn(updating.id, "C"); // 작업 대기 중 = 갱신 중
    await approveIn(failed.id, "D");
    await drainSpecJobs(failed.id, new FakeSpecWriter({ failWith: "REFUSED" }));

    const home = await getHome(w.member);
    expect(findFeature(home, none.id)).toMatchObject({ specStatus: "NONE", latestVersion: null, pendingReflectCount: 0 });
    expect(findFeature(home, idle.id)).toMatchObject({ specStatus: "IDLE", latestVersion: 1, pendingReflectCount: 0 });
    expect(findFeature(home, idle.id).latestVersionAt).not.toBeNull();
    expect(findFeature(home, updating.id)).toMatchObject({ specStatus: "UPDATING", latestVersion: null, updatingToVersion: 1, pendingReflectCount: 1 });
    expect(findFeature(home, failed.id)).toMatchObject({ specStatus: "FAILED", pendingReflectCount: 1 });
    expect(findFeature(home, finalized.id)).toMatchObject({ specStatus: "FINALIZED", latestVersion: 1, pendingReflectCount: 1 });
  });

  it("getSpec의 상태와 항상 일치한다", async () => {
    const features = [await newFeature("a"), await newFeature("b"), await newFeature("c")];
    await approvedInput(w, "x"); // w.feature: 작업 대기
    await submitInput(w.admin, w.board.id, features[0].id, { kind: "IDEA", content: "1" });
    await drainSpecJobs(features[0].id, new FakeSpecWriter());
    await submitInput(w.admin, w.board.id, features[1].id, { kind: "IDEA", content: "2" });
    await drainSpecJobs(features[1].id, new FakeSpecWriter({ failWith: "API_ERROR" }));

    const home = await getHome(w.admin);
    for (const f of [w.feature, ...features]) {
      const spec = await getSpec(w.admin, w.board.id, f.id);
      expect(findFeature(home, f.id).specStatus).toBe(spec.status);
    }
  });

  it("보드마다 내 역할이 다르고 관리자 보드에만 승인 대기 수가 있다", async () => {
    const other = await testDb.board.create({ data: { name: "다른 보드" } });
    await testDb.membership.create({ data: { boardId: other.id, userId: w.admin.id, role: "VIEWER" } });
    await newFeature("o", other.id);
    await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "대기" });

    const home = await getHome(w.admin);
    const mine = home.boards.find((b) => b.id === w.board.id)!;
    const theirs = home.boards.find((b) => b.id === other.id)!;
    expect(mine).toMatchObject({ role: "ADMIN", pendingApprovalCount: 1 });
    expect(theirs).toMatchObject({ role: "VIEWER", pendingApprovalCount: null });
    expect((await getHome(w.member)).boards[0]).toMatchObject({ role: "MEMBER", pendingApprovalCount: null });
  });

  it("속하지 않은 보드는 나오지 않는다", async () => {
    expect((await getHome(w.outsider)).boards).toEqual([]);
  });

  it("쿼리 수가 feature 수에 비례하지 않는다", async () => {
    const queries: string[] = [];
    const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
    client.$on("query", (e: { query: string }) => queries.push(e.query));
    try {
      await getHome(w.admin, client);
      const baseline = queries.length;
      queries.length = 0;
      for (let i = 0; i < 25; i++) await newFeature(`다수-${i}`);
      await getHome(w.admin, client);
      expect(queries.length).toBe(baseline);
    } finally {
      await client.$disconnect();
    }
  });
});
