import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/*pod*.integration.test.ts"],
  },
});
