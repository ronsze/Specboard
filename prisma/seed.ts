import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

export const SEED_PASSWORD = "specboard123";

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const users = [
    { email: "admin@specboard.local", displayName: "관리자", role: "ADMIN" as const },
    { email: "member@specboard.local", displayName: "멤버", role: "MEMBER" as const },
    { email: "viewer@specboard.local", displayName: "열람자", role: "VIEWER" as const },
  ];

  const board = await db.board.create({ data: { name: "Specboard 팀" } });
  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, displayName: u.displayName, passwordHash },
    });
    await db.membership.create({ data: { boardId: board.id, userId: user.id, role: u.role } });
  }
  const project = await db.project.create({ data: { boardId: board.id, name: "Specboard" } });
  const feature = await db.feature.create({ data: { projectId: project.id, name: "입력 제출과 승인" } });
  console.log(`board=${board.id} feature=${feature.id}`);
}

main().finally(() => db.$disconnect());
