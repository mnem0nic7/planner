import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    // Tests share one SQLite file — must run sequentially
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
