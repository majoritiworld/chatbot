import { defineConfig, devices } from "@playwright/test";

// An isolated server with dummy credentials: these access tests cannot send
// mail, call a model, or mutate the real Supabase project.
const baseURL = "http://127.0.0.1:3101";

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [{ name: "e2e", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "github" : "list",
  retries: 0,
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "pnpm exec next dev --port 3101 --hostname 127.0.0.1",
    env: {
      AI_GATEWAY_API_KEY: "",
      AUTH_SECRET: "local-test-only",
      BLOQUEAR_CORREO_ENTREVISTA: "1",
      IS_DEMO: "0",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      OPENAI_API_KEY: "",
      PLAYWRIGHT_ISOLATED: "1",
      POSTGRES_URL: "",
      RESEND_API_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${baseURL}/ping`,
  },
  workers: 2,
});
