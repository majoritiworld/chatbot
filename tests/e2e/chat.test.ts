import { expect, test } from "@playwright/test";

for (const path of [
  "/",
  "/portal",
  "/portal/entrevista/40000000-0000-4000-8000-000000000001",
  "/chat/40000000-0000-4000-8000-000000000001",
  "/admin",
]) {
  test(`unauthenticated navigation to ${path} requires login`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\/admin)?\?next=/);
    await expect(page.getByTestId("multimodal-input")).toHaveCount(0);
  });
}
