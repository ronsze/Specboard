import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, rejectInput, submitInput, listApprovedInputs, listPendingInputs } from "@/server/services/inputs";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";

let w: World;
const submit = (user = w.member, content = "x") =>
  submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content });

beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("승인·반려 (시나리오 4~7)", () => {
  it("승인하면 승인자와 시각이 기록된다", async () => {
    const i = await submit();
    const done = await approveInput(w.admin, w.board.id, i.id);
    expect(done.status).toBe("APPROVED");
    expect(done.decidedByName).toBe("관리자");
    expect(done.decidedAt).not.toBeNull();
    expect(done.autoApproved).toBe(false);
  });

  it("사유 없는 반려는 거부하고 상태는 그대로다", async () => {
    const i = await submit();
    for (const reason of ["", "  "]) {
      await expect(rejectInput(w.admin, w.board.id, i.id, { reason })).rejects.toBeInstanceOf(ValidationError);
    }
    const [still] = await listPendingInputs(w.admin, w.board.id, w.feature.id);
    expect(still.status).toBe("PENDING");
  });

  it("사유와 함께 반려하면 사유·반려자·시각이 남고 제출자가 볼 수 있다", async () => {
    const i = await submit();
    const done = await rejectInput(w.admin, w.board.id, i.id, { reason: "범위 밖" });
    expect(done).toMatchObject({ status: "REJECTED", rejectionReason: "범위 밖", decidedByName: "관리자" });
  });

  it("처리된 입력은 다시 처리할 수 없다 (409)", async () => {
    const i = await submit();
    await approveInput(w.admin, w.board.id, i.id);
    await expect(rejectInput(w.admin, w.board.id, i.id, { reason: "r" })).rejects.toBeInstanceOf(ConflictError);
    await expect(approveInput(w.admin, w.board.id, i.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("관리자가 아니면 승인·반려할 수 없다", async () => {
    const i = await submit();
    for (const user of [w.member, w.viewer, w.outsider]) {
      await expect(approveInput(user, w.board.id, i.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(rejectInput(user, w.board.id, i.id, { reason: "r" })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("동시 처리 (시나리오 8)", () => {
  it("동시에 승인·반려해도 한쪽만 성공한다", async () => {
    const i = await submit();
    const results = await Promise.allSettled([
      approveInput(w.admin, w.board.id, i.id),
      rejectInput(w.admin, w.board.id, i.id, { reason: "r" }),
      approveInput(w.admin, w.board.id, i.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    }
  });
});

describe("사용 가능 입력 (시나리오 9)", () => {
  it("APPROVED만 반환한다", async () => {
    const a = await submit(w.member, "approve");
    const r = await submit(w.member, "reject");
    await submit(w.member, "pending");
    await approveInput(w.admin, w.board.id, a.id);
    await rejectInput(w.admin, w.board.id, r.id, { reason: "r" });
    const list = await listApprovedInputs(w.viewer, w.board.id, w.feature.id);
    expect(list.map((x) => x.content)).toEqual(["approve"]);
  });

  it("관리자 제출(자동 승인)도 포함한다", async () => {
    await submit(w.admin, "by-admin");
    const list = await listApprovedInputs(w.member, w.board.id, w.feature.id);
    expect(list.map((x) => x.content)).toEqual(["by-admin"]);
  });
});
