import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    pool: "threads",
    env: {
      JWT_SECRET: "test-secret-do-not-use-in-production",
    },
  },
});
