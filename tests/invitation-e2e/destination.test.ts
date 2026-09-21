import { expect, type Page, test } from "@playwright/test";

const target = "/portal/entrevista/40000000-0000-4000-8000-000000000002";
const home = "/portal/entrevista/40000000-0000-4000-8000-000000000001";
const missing = "/portal/entrevista/40000000-0000-4000-8000-000000000099";
const service = "http://127.0.0.1:54431";
const nextQuery = `next=${encodeURIComponent(target)}`;
const finalPath = (path: string) => new RegExp(`${path}$`);

async function requestCode(page: Page) {
  await page
    .getByLabel("Email", { exact: true })
    .fill("participant@example.test");
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByLabel("Código", { exact: true })).toBeVisible();
}

async function enterCode(page: Page) {
  await page.getByLabel("Código", { exact: true }).fill("12345678");
}

test.beforeEach(async ({ request }) => {
  await request.delete(`${service}/test/events`);
});

test("request, resend and OTP keep the assigned interview, not the older home", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto(`/login?${nextQuery}`);
  await requestCode(page);
  await page.clock.runFor(61_000);
  await page
    .getByRole("button", { exact: true, name: "Reenviar código" })
    .click();
  await expect
    .poll(async () => {
      const events = await (await request.get(`${service}/test/events`)).json();
      return events.filter(
        (event: { path: string }) => event.path === "/auth/v1/otp"
      ).length;
    })
    .toBe(2);
  const events = await (await request.get(`${service}/test/events`)).json();
  for (const event of events) {
    expect(new URL(event.redirectTo).searchParams.get("next")).toBe(target);
  }
  await enterCode(page);
  await expect(page).toHaveURL(finalPath(target));
  await expect(
    page.getByText("Antes de empezar", { exact: true })
  ).toBeVisible();
  await page.goto(`/login?next=${encodeURIComponent(home)}`);
  await expect(page).toHaveURL(finalPath(home));
  await page.goto(`/login?${nextQuery}`);
  await expect(page).toHaveURL(finalPath(target));
});

test("expired callback recovers via OTP without losing next or exposing token", async ({
  page,
}) => {
  await page.goto(
    `/auth/callback?token_hash=expired-synthetic-token&type=magiclink&${nextQuery}`
  );
  await expect(
    page.getByText("Ese acceso ya no sirve.", { exact: false })
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(target);
  expect(page.url()).not.toContain("token_hash");
  await requestCode(page);
  await enterCode(page);
  await expect(page).toHaveURL(finalPath(target));
});

test("valid magic-link callback preserves assignment", async ({ page }) => {
  await page.goto(
    `/auth/callback?token_hash=valid-synthetic-token&type=magiclink&${nextQuery}`
  );
  await expect(page).toHaveURL(finalPath(target));
});

test("OTP without next still uses the role landing", async ({ page }) => {
  await page.goto("/login");
  await requestCode(page);
  await enterCode(page);
  await expect(page).toHaveURL(finalPath(home));
});

test("external next never redirects off site", async ({ page }) => {
  await page.goto(
    `/login?next=${encodeURIComponent("https://invalid.example/steal")}`
  );
  await requestCode(page);
  await enterCode(page);
  await expect(page).toHaveURL(finalPath(home));
});

test("inaccessible assignment is not replaced by another interview", async ({
  page,
}) => {
  await page.goto(`/login?next=${encodeURIComponent(missing)}`);
  await requestCode(page);
  await enterCode(page);
  await expect(page).toHaveURL(finalPath(missing));
  await expect(
    page.getByText("Esta entrevista no existe o no te corresponde.", {
      exact: true,
    })
  ).toBeVisible();
});
