import { defineConfig, devices } from "@playwright/test";

// Next dev canonicalizes route-handler redirects to localhost.
const baseURL = "http://localhost:3141";

export default defineConfig({
  // A cold dev compilation of the interview route can exceed 20 seconds.
  expect: { timeout: 60_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  reporter: "list",
  retries: 0,
  testDir: "./tests/invitation-e2e",
  timeout: 90_000,
  use: { ...devices["Desktop Chrome"], baseURL, trace: "off" },
  webServer: [
    {
      command: "pnpm exec tsx tests/support/invitation-auth-server.ts",
      reuseExistingServer: false,
      url: "http://127.0.0.1:54431/health",
    },
    {
      command: "pnpm exec next dev --webpack --port 3141 --hostname 127.0.0.1",
      env: {
        AI_GATEWAY_API_KEY: "",
        AUTH_SECRET: "local-test-only",
        BLOQUEAR_CORREO_ENTREVISTA: "1",
        INTERVIEW_EMAIL_FROM: "",
        IS_DEMO: "0",
        NEXT_PUBLIC_SITE_URL: baseURL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54431",
        OPENAI_API_KEY: "",
        PLAYWRIGHT_ISOLATED: "1",
        POSTGRES_URL: "",
        RESEND_API_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${baseURL}/ping`,
    },
  ],
  workers: 1,
});
