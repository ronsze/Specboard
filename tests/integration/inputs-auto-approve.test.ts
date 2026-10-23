import { beforeEach, expect, it } from "vitest";
import { submitInput } from "@/server/services/inputs";
import { resetDb, seedWorld, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

it("관리자 제출은 즉시 APPROVED이고 자동 승인으로 기록된다 (시나리오 3)", async () => {
  const i = await submitInput(w.admin, w.board.id, w.feature.id, { kind: "MEETING_NOTE", content: "회의" });
  expect(i).toMatchObject({ status: "APPROVED", autoApproved: true, decidedByName: "관리자" });
  expect(i.decidedAt).not.toBeNull();
});
