import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireRole } from "@/server/authz/authorize";
import { ForbiddenError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "../integration/helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("requireRole", () => {
  it("허용된 역할은 역할을 반환한다", async () => {
    await expect(requireRole(w.admin.id, w.board.id, ["ADMIN"])).resolves.toBe("ADMIN");
    await expect(requireRole(w.member.id, w.board.id, ["ADMIN", "MEMBER"])).resolves.toBe("MEMBER");
  });

  it("허용되지 않은 역할은 거부한다", async () => {
    await expect(requireRole(w.member.id, w.board.id, ["ADMIN"])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireRole(w.viewer.id, w.board.id, ["ADMIN", "MEMBER"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("비멤버는 거부한다", async () => {
    await expect(requireRole(w.outsider.id, w.board.id, ["ADMIN", "MEMBER", "VIEWER"])).rejects.toBeInstanceOf(ForbiddenError);
  });
});

beforeAll(async () => {
  await testDb.$connect();
});
