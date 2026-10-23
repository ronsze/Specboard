import { beforeEach, describe, expect, it } from "vitest";
import {
  approveInput,
  listApprovedInputs,
  listInputs,
  listPendingInputs,
  rejectInput,
  submitInput,
} from "@/server/services/inputs";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const submit = (user: World["member"], content: string) =>
  submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content });

describe("권한 매트릭스 (시나리오 10, 11)", () => {
  it("열람: 멤버·열람자·관리자는 가능, 비멤버는 403", async () => {
    for (const user of [w.admin, w.member, w.viewer]) {
      await expect(listInputs(user, w.board.id, w.feature.id)).resolves.toBeTruthy();
      await expect(listApprovedInputs(user, w.board.id, w.feature.id)).resolves.toBeTruthy();
    }
    await expect(listInputs(w.outsider, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listApprovedInputs(w.outsider, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("대기 목록은 관리자만 조회한다", async () => {
    await expect(listPendingInputs(w.admin, w.board.id, w.feature.id)).resolves.toBeTruthy();
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(listPendingInputs(user, w.board.id, w.feature.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("승인·반려는 관리자만 한다", async () => {
    const i = await submit(w.member, "x");
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(approveInput(user, w.board.id, i.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(rejectInput(user, w.board.id, i.id, { reason: "r" })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("대기 입력 노출 제한 (FR-021)", () => {
  it("비관리자의 status=PENDING 요청은 403", async () => {
    for (const user of [w.member, w.viewer]) {
      await expect(listInputs(user, w.board.id, w.feature.id, "PENDING")).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(listInputs(w.admin, w.board.id, w.feature.id, "PENDING")).resolves.toBeTruthy();
  });

  it("타인의 대기 입력은 목록에 없고 본인의 것은 보인다", async () => {
    await submit(w.member, "A의 대기");
    const approved = await submit(w.member, "A의 승인");
    await approveInput(w.admin, w.board.id, approved.id);

    const forB = await listInputs(w.member2, w.board.id, w.feature.id);
    expect(forB.map((i) => i.content)).toEqual(["A의 승인"]);

    const forA = await listInputs(w.member, w.board.id, w.feature.id);
    expect(forA.map((i) => i.content).sort()).toEqual(["A의 대기", "A의 승인"]);

    const forViewer = await listInputs(w.viewer, w.board.id, w.feature.id);
    expect(forViewer.map((i) => i.content)).toEqual(["A의 승인"]);

    const forAdmin = await listInputs(w.admin, w.board.id, w.feature.id);
    expect(forAdmin).toHaveLength(2);
  });
});
