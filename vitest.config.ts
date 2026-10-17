import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup/env.ts"],
    // Integration suites share one in-memory MongoDB replica set per file.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
