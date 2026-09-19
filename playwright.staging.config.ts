import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.staging.local" });

const baseURL = process.env.STAGING_BASE_URL;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  projects: [{ name: "staging", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  retries: 0,
  testDir: "./tests/staging",
  timeout: 60_000,
  use: {
    baseURL: baseURL ?? "http://127.0.0.1:3999",
    trace: "retain-on-failure",
  },
  workers: 1,
});
