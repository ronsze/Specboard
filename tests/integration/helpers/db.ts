import { PrismaClient, type Role } from "@prisma/client";

export const testDb = new PrismaClient();

export async function resetDb() {
  await testDb.conflictWarning.deleteMany();
  await testDb.conflictCheck.deleteMany();
  await testDb.specJob.deleteMany();
  await testDb.spec.deleteMany();
  await testDb.input.deleteMany();
  await testDb.feature.deleteMany();
  await testDb.project.deleteMany();
  await testDb.membership.deleteMany();
  await testDb.board.deleteMany();
  await testDb.user.deleteMany();
}

export type World = Awaited<ReturnType<typeof seedWorld>>;

/** 보드 1개, 역할별 사용자(관리자·멤버·열람자·다른 멤버·비멤버), feature 1개. */
export async function seedWorld() {
  const board = await testDb.board.create({ data: { name: "테스트 보드" } });
  const mk = (key: string, name: string) =>
    testDb.user.create({
      data: { email: `${key}@test.local`, displayName: name, passwordHash: "x" },
    });
  const join = (userId: string, role: Role) =>
    testDb.membership.create({ data: { boardId: board.id, userId, role } });

  const admin = await mk("admin", "관리자");
  const member = await mk("member", "멤버");
  const member2 = await mk("member2", "멤버2");
  const viewer = await mk("viewer", "열람자");
  const outsider = await mk("outsider", "외부인");
  await join(admin.id, "ADMIN");
  await join(member.id, "MEMBER");
  await join(member2.id, "MEMBER");
  await join(viewer.id, "VIEWER");

  const project = await testDb.project.create({ data: { boardId: board.id, name: "P" } });
  const feature = await testDb.feature.create({ data: { projectId: project.id, name: "F" } });
  const u = (x: { id: string; displayName: string }) => ({ id: x.id, displayName: x.displayName });
  return {
    board,
    feature,
    admin: u(admin),
    member: u(member),
    member2: u(member2),
    viewer: u(viewer),
    outsider: u(outsider),
  };
}
