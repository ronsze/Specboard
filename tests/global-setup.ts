import { execSync } from "node:child_process";

export const TEST_DATABASE_URL = "postgresql://specboard:specboard@localhost:5433/specboard_test";

/** 개발 DB를 지우지 않도록 테스트 전용 DB를 만들고 마이그레이션을 적용한다. */
export default function setup() {
  execSync(`docker compose exec -T db psql -U specboard -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='specboard_test'" | grep -q 1 || docker compose exec -T db psql -U specboard -d postgres -c "CREATE DATABASE specboard_test"`, { stdio: "ignore" });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "ignore",
  });
}
