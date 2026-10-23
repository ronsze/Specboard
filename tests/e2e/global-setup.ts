import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

/**
 * 이전 E2E 실행이 개발 DB에 남긴 데이터(이름·본문에 13자리 타임스탬프가 들어간 feature와 입력)를 지운다.
 * 쌓이면 보드 단위 화면이 느려져 테스트가 불안정해진다. 시드 데이터와 사람이 직접 만든 데이터는 건드리지 않는다.
 */
export default async function globalSetup() {
  config({ path: ".env", quiet: true });
  const db = new PrismaClient();
  try {
    await db.$executeRaw`DELETE FROM "Feature" WHERE "name" ~ '[0-9]{13}'`;
    await db.$executeRaw`DELETE FROM "Input" WHERE "content" ~ '[0-9]{13}'`;
  } finally {
    await db.$disconnect();
  }
}
