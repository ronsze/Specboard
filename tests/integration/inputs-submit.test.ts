import { beforeEach, describe, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { resetDb, seedWorld, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("submitInput (시나리오 1, 2)", () => {
  it("멤버의 한 줄 아이디어는 PENDING으로 저장되고 제출자·시각이 기록된다", async () => {
    const input = await submitInput(w.member, w.board.id, w.feature.id, {
      kind: "IDEA",
      content: "승인 알림이 있으면 좋겠다",
    });
    expect(input.status).toBe("PENDING");
    expect(input.kind).toBe("IDEA");
    expect(input.submitterName).toBe("멤버");
    expect(input.autoApproved).toBe(false);
    expect(new Date(input.submittedAt).getTime()).toBeGreaterThan(0);
  });

  it("빈 내용과 공백뿐인 내용은 거부한다", async () => {
    for (const content of ["", "   \n\t "]) {
      await expect(
        submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("50,000자는 허용하고 50,001자는 거부한다", async () => {
    await expect(
      submitInput(w.member, w.board.id, w.feature.id, { kind: "MEETING_NOTE", content: "a".repeat(50_000) }),
    ).resolves.toBeTruthy();
    await expect(
      submitInput(w.member, w.board.id, w.feature.id, { kind: "MEETING_NOTE", content: "a".repeat(50_001) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("알 수 없는 종류는 거부한다", async () => {
    await expect(
      submitInput(w.member, w.board.id, w.feature.id, { kind: "NOPE" as never, content: "x" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("다른 보드의 feature에는 제출할 수 없다", async () => {
    await expect(
      submitInput(w.member, w.board.id, "no-such-feature", { kind: "IDEA", content: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("열람자와 비멤버는 제출할 수 없다", async () => {
    for (const user of [w.viewer, w.outsider]) {
      await expect(
        submitInput(user, w.board.id, w.feature.id, { kind: "IDEA", content: "x" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});
