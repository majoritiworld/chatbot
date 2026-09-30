import { execFileSync } from "node:child_process";
import { test } from "@playwright/test";

test("interview mail resolves the assignment on the server, blocks mismatches, and keeps invitations off", () => {
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
