/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// バランスの回帰テスト。CPU に何分も遊ばせるので普段の pnpm test には入れず、pnpm test:balance で別に回す
export default defineConfig({
  test: {
    include: ["tests/balance/**/*.balance.ts"],
    environment: "node",
    testTimeout: 600_000,
  },
});
