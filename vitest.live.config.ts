import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/live/**/*.test.ts"], setupFiles: ["tests/live-setup.ts"], testTimeout: 480_000 },
});
