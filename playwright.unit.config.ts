import { defineConfig } from "@playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  testDir: "./tests/unit",
  timeout: 30_000,
  workers: 2,
});
