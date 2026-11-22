import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: "postgresql://vardia:vardia@localhost:5432/vardia?schema=public",
      JWT_SECRET: "test-vardia-secret",
    },
  },
});
