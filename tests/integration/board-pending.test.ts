import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, rejectInput, submitInput } from "@/server/services/inputs";
import { countBoardPending, listBoardPending } from "@/server/services/board-pending";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
let feature2: { id: string };
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
  const project2 = await testDb.project.create({ data: { boardId: w.board.id, name: "두 번째 프로젝트" } });
  feature2 = await testDb.feature.create({ data: { projectId: project2.id, name: "장바구니" } });
});

const submit = (content: string, featureId = w.feature.id, user = w.member) =>
  submitInput(user, w.board.id, featureId, { kind: "IDEA", content });

describe("보드 단위 승인 대기 (시나리오 13~15)", () => {
  it("여러 feature의 대기 입력이 오래된 순으로 한 목록에 나오고 프로젝트·feature 이름이 붙는다", async () => {
    await submit("첫째", w.feature.id);
    await submit("둘째", feature2.id);
    await submit("셋째", w.feature.id, w.member2);
    const list = await listBoardPending(w.admin, w.board.id);
    expect(list.map((i) => i.content)).toEqual(["첫째", "둘째", "셋째"]);
    expect(list.map((i) => [i.projectName, i.featureName])).toEqual([
      ["P", "F"],
      ["두 번째 프로젝트", "장바구니"],
      ["P", "F"],
    ]);
    expect(list[0].featureId).toBe(w.feature.id);
    expect(await countBoardPending(w.admin, w.board.id)).toBe(3);
  });

  it("feature 필터를 적용할 수 있다", async () => {
    await submit("A", w.feature.id);
    await submit("B", feature2.id);
    const list = await listBoardPending(w.admin, w.board.id, { featureId: feature2.id });
    expect(list.map((i) => i.content)).toEqual(["B"]);
  });

  it("승인·반려하면 목록과 개수가 줄어든다", async () => {
    const a = await submit("A");
    const b = await submit("B", feature2.id);
    await approveInput(w.admin, w.board.id, a.id);
    expect(await countBoardPending(w.admin, w.board.id)).toBe(1);
    await rejectInput(w.admin, w.board.id, b.id, { reason: "범위 밖" });
    expect(await countBoardPending(w.admin, w.board.id)).toBe(0);
    expect(await listBoardPending(w.admin, w.board.id)).toEqual([]);
  });

  it("관리자 제출(자동 승인)은 대기 목록에 없다", async () => {
    await submit("관리자 입력", w.feature.id, w.admin);
    expect(await countBoardPending(w.admin, w.board.id)).toBe(0);
  });

  it("다른 보드의 입력은 섞이지 않는다", async () => {
    const other = await testDb.board.create({ data: { name: "다른 보드" } });
    const project = await testDb.project.create({ data: { boardId: other.id, name: "OP" } });
    const feature = await testDb.feature.create({ data: { projectId: project.id, name: "OF" } });
    await testDb.membership.create({ data: { boardId: other.id, userId: w.member.id, role: "MEMBER" } });
    await submitInput(w.member, other.id, feature.id, { kind: "IDEA", content: "다른 보드" });
    await submit("이 보드");
    expect((await listBoardPending(w.admin, w.board.id)).map((i) => i.content)).toEqual(["이 보드"]);
  });

  it("이미 처리된 입력을 다시 처리하면 409 (다른 관리자가 먼저 처리한 경우)", async () => {
    const a = await submit("A");
    await approveInput(w.admin, w.board.id, a.id);
    await expect(rejectInput(w.admin, w.board.id, a.id, { reason: "r" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("관리자가 아니면 목록·개수 모두 403", async () => {
    await submit("A");
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(listBoardPending(user, w.board.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(countBoardPending(user, w.board.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});
