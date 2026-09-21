import { execFileSync } from "node:child_process";
import { test } from "@playwright/test";

test("personal invitation is not copied to the team; thank-you policy remains", () => {
  execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import=tsx",
      "tests/support/check-invitation-mail.ts",
    ],
    { cwd: process.cwd(), stdio: "pipe" }
  );
});
