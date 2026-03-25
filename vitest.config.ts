import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["src/tests/setup-test-db.ts"],
    include: ["src/cli/tests/**/*.test.ts"],
  },
});
