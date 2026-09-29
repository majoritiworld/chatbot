import { execFileSync } from "node:child_process";
import { test } from "@playwright/test";

test("completion mail is branded, copied to the team, and idempotent", () => {
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
