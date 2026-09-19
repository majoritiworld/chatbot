import { expect, test } from "@playwright/test";

test("portal login uses invited email access", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Portal de consultoría" })
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviarme el código" })
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(
    page.getByText("El acceso es solo para personas invitadas", {
      exact: false,
    })
  ).toBeVisible();
});

test("public registration redirects to invited login", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Portal de consultoría" })
  ).toBeVisible();
});

test("Majoriti login is reachable and requires a password", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Equipo Majoriti" }).click();
  await expect(page).toHaveURL(/\/login\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Acceso Majoriti" })
  ).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
});

test("expired access shows recovery instructions", async ({ page }) => {
  await page.goto("/login?error=auth");
  await expect(
    page.getByText(
      "Ese acceso ya no sirve. Pide un código aquí y entras igual."
    )
  ).toBeVisible();
});
