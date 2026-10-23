import { beforeEach, describe, expect, it } from "vitest";
import { addMember, changeRole, listMembers } from "@/server/services/members";
import { listInputs, submitInput } from "@/server/services/inputs";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("멤버 관리", () => {
  it("관리자는 멤버를 추가하고 역할을 변경한다", async () => {
    const added = await addMember(w.admin, w.board.id, { email: "outsider@test.local", role: "VIEWER" });
    expect(added.role).toBe("VIEWER");
    const changed = await changeRole(w.admin, w.board.id, w.outsider.id, { role: "MEMBER" });
    expect(changed.role).toBe("MEMBER");
    expect((await listMembers(w.admin, w.board.id)).map((m) => m.role).sort()).toContain("MEMBER");
  });

  it("없는 이메일은 404, 이미 멤버면 409", async () => {
    await expect(addMember(w.admin, w.board.id, { email: "none@test.local", role: "MEMBER" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(addMember(w.admin, w.board.id, { email: "member@test.local", role: "MEMBER" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("관리자가 아니면 멤버를 관리할 수 없다", async () => {
    await expect(listMembers(w.member, w.board.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeRole(w.member, w.board.id, w.viewer.id, { role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("유일한 관리자 강등은 409 (시나리오 12)", async () => {
    await expect(changeRole(w.admin, w.board.id, w.admin.id, { role: "MEMBER" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("관리자가 둘이면 한 명은 강등할 수 있다", async () => {
    await changeRole(w.admin, w.board.id, w.member.id, { role: "ADMIN" });
    await expect(changeRole(w.admin, w.board.id, w.admin.id, { role: "MEMBER" })).resolves.toBeTruthy();
  });

  it("두 관리자가 동시에 서로를 강등해도 관리자는 1명 이상 남는다", async () => {
    await changeRole(w.admin, w.board.id, w.member.id, { role: "ADMIN" });
    await Promise.allSettled([
      changeRole(w.admin, w.board.id, w.member.id, { role: "VIEWER" }),
      changeRole(w.member, w.board.id, w.admin.id, { role: "VIEWER" }),
    ]);
    const admins = await testDb.membership.count({ where: { boardId: w.board.id, role: "ADMIN" } });
    expect(admins).toBeGreaterThanOrEqual(1);
  });

  it("제출 후 제출자가 열람자로 낮아져도 기존 입력은 유지된다", async () => {
    await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "유지" });
    await changeRole(w.admin, w.board.id, w.member.id, { role: "VIEWER" });
    const list = await listInputs(w.admin, w.board.id, w.feature.id);
    expect(list.map((i) => i.content)).toEqual(["유지"]);
  });
});
