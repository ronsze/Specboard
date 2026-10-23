import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { ValidationError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const submit = (content: string, user = w.member) =>
  submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content });

describe("입력 번호 (시나리오 2)", () => {
  it("같은 보드에서 동시에 20개를 제출해도 1..20이 중복·결번 없이 부여된다", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => submit(`입력 ${i}`)));
    expect(results.map((r) => r.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const board = await testDb.board.findUniqueOrThrow({ where: { id: w.board.id } });
    expect(board.inputSeq).toBe(20);
  });

  it("검증에 실패한 제출은 번호를 소비하지 않는다", async () => {
    await submit("첫 입력");
    await expect(submit("   ")).rejects.toBeInstanceOf(ValidationError);
    const second = await submit("둘째 입력");
    expect(second.number).toBe(2);
  });

  it("보드가 다르면 번호가 각각 1부터 시작한다", async () => {
    const other = await testDb.board.create({ data: { name: "다른 보드" } });
    const project = await testDb.project.create({ data: { boardId: other.id, name: "P2" } });
    const feature = await testDb.feature.create({ data: { projectId: project.id, name: "F2" } });
    await testDb.membership.create({ data: { boardId: other.id, userId: w.member.id, role: "MEMBER" } });

    const a = await submit("보드 A");
    const b = await submitInput(w.member, other.id, feature.id, { kind: "IDEA", content: "보드 B" });
    expect([a.number, b.number]).toEqual([1, 1]);
  });

  it("관리자 자동 승인 입력도 같은 번호 체계를 쓴다", async () => {
    const a = await submit("멤버");
    const b = await submit("관리자", w.admin);
    expect([a.number, b.number]).toEqual([1, 2]);
  });
});
