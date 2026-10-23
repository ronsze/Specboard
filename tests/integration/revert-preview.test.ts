import { beforeEach, describe, expect, it } from "vitest";
import { finalizeSpec, previewRevert, revertSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const add = async (text: string) => {
  await approvedInput(w, text);
  await drainSpecJobs(w.feature.id, new FakeSpecWriter());
};
const preview = (to: number, user = w.admin) => previewRevert(user, w.board.id, w.feature.id, to);
const revert = (to: number, expected?: Parameters<typeof revertSpec>[4]) =>
  revertSpec(w.admin, w.board.id, w.feature.id, to, expected);

/** v1: R-1 / v2: + 질문 Q-1(열림) / v3: 답으로 Q-1 해소 + D-1 추가 / v4: + R-2 */
async function seedHistory() {
  await add("요구 하나");
  await add("알림은 언제?");
  await add("답: 즉시");
  await add("요구 둘");
}

/** 실제로 되돌린 결과에서 영향을 다시 계산한다 */
async function actualImpact(latestNumber: number) {
  const versions = await versionsOf(w.feature.id);
  const latest = versions.find((v) => v.number === latestNumber)!;
  const created = versions.at(-1)!;
  const keys = new Set(created.items.map((i) => i.key));
  const removed = latest.items.filter((i) => !keys.has(i.key)).length;
  const reopened = latest.questions.filter((q) => {
    const now = created.questions.find((x) => x.key === q.key);
    return q.status === "RESOLVED" && (!now || now.status !== "RESOLVED");
  }).length;
  return { removed, reopened };
}

describe("되돌리기 영향 미리보기 (시나리오 19)", () => {
  it.each([1, 2, 3])("버전 %i로의 미리보기 수치가 실제 되돌린 결과와 일치한다", async (target) => {
    await seedHistory();
    const p = await preview(target);
    expect(p).toMatchObject({ toVersion: target, latestVersion: 4, newVersion: 5, finalized: false });
    await revert(target);
    const actual = await actualImpact(4);
    expect(p.removedItems).toBe(actual.removed);
    expect(p.reopenedQuestions).toBe(actual.reopened);
    expect(p.removedLabels).toHaveLength(p.removedItems);
    expect(p.reopenedLabels).toHaveLength(p.reopenedQuestions);
  });

  it("빠지는 항목과 다시 열리는 질문의 라벨을 돌려준다", async () => {
    await seedHistory();
    const p = await preview(2); // v2: R-1 + Q-1(열림)
    expect(p.removedLabels.sort()).toEqual(["D-1", "R-2"]);
    expect(p.reopenedLabels).toEqual(["Q-1"]);
  });

  it("확정 상태는 409(FINALIZED), 최신과 같은 내용은 409(NO_CHANGE)", async () => {
    await seedHistory();
    await expect(preview(4)).rejects.toMatchObject({ status: 409, details: { code: "NO_CHANGE" } });
    await finalizeSpec(w.admin, w.board.id, w.feature.id);
    await expect(preview(1)).rejects.toMatchObject({ status: 409, details: { code: "FINALIZED" } });
    await expect(revert(1)).rejects.toMatchObject({ status: 409, details: { code: "FINALIZED" } });
  });

  it("관리자만 미리볼 수 있다", async () => {
    await seedHistory();
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(preview(1, user)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("expected 확인 (FR-030)", () => {
  it("expected가 미리보기와 같으면 실행된다", async () => {
    await seedHistory();
    const p = await preview(2);
    const created = await revert(2, { latestVersion: p.latestVersion, removedItems: p.removedItems, reopenedQuestions: p.reopenedQuestions });
    expect(created.number).toBe(5);
  });

  it("미리보기 뒤에 최신 버전이 바뀌면 실행하지 않고 PREVIEW_CHANGED와 최신 미리보기를 돌려준다", async () => {
    await seedHistory();
    const p = await preview(2);
    await add("미리보기 이후 입력"); // v5
    let error: unknown;
    try {
      await revert(2, { latestVersion: p.latestVersion, removedItems: p.removedItems, reopenedQuestions: p.reopenedQuestions });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConflictError);
    const details = (error as ConflictError).details as { code: string; preview: { latestVersion: number; newVersion: number } };
    expect(details.code).toBe("PREVIEW_CHANGED");
    expect(details.preview).toMatchObject({ latestVersion: 5, newVersion: 6 });
    expect((await versionsOf(w.feature.id)).length).toBe(5); // 되돌리기 버전이 만들어지지 않았다
    expect(await testDb.specVersion.count({ where: { kind: "REVERT" } })).toBe(0);
  });

  it("expected를 생략하면 기존처럼 실행된다 (하위 호환)", async () => {
    await seedHistory();
    await expect(revert(2)).resolves.toMatchObject({ number: 5, kind: "REVERT" });
  });
});
