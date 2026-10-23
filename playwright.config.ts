import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1, // 개발 DB의 같은 보드를 공유하므로 직렬로 실행한다
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "SPEC_WRITER=fake npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
  },
});
