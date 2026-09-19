import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  cuentasDesdeEntorno,
  exigirSesionAutorizada,
  extraerAccessToken,
} from "../support/staging-accounts";

const configured = Boolean(
  process.env.STAGING_BASE_URL &&
    process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_ALLOWED_EMAILS &&
    process.env.STAGING_ALLOWED_IDS &&
    process.env.STAGING_PARTICIPANT_STORAGE_STATE &&
    process.env.STAGING_INTERVIEW_PATH &&
    process.env.STAGING_PARTICIPANT_EMAIL &&
    process.env.STAGING_OTHER_EMAIL &&
    process.env.STAGING_MAJORITI_EMAIL &&
    process.env.STAGING_PARTICIPANT_ID &&
    process.env.STAGING_OTHER_ID &&
    process.env.STAGING_MAJORITI_ID
);

test.describe("Staging interview application flow", () => {
  test.skip(
    !configured,
    "Copia .env.staging.example a .env.staging.local con tres cuentas exclusivas de prueba."
  );

  test.beforeAll(async () => {
    if (!configured) {
      return;
    }
    const cuentas = cuentasDesdeEntorno();
    const storagePath = process.env.STAGING_PARTICIPANT_STORAGE_STATE ?? "";
    const storage = JSON.parse(readFileSync(storagePath, "utf8")) as unknown;
    const token = extraerAccessToken(storage);
    if (!token) {
      throw new Error(
        "El storageState de Playwright no tiene un access token de la cuenta de prueba."
      );
    }
    await exigirSesionAutorizada({
      anonKey: process.env.STAGING_SUPABASE_ANON_KEY ?? "",
      expected: cuentas.participant,
      supabaseUrl: process.env.STAGING_SUPABASE_URL ?? "",
      token,
    });
  });

  if (configured) {
    test.use({
      storageState: process.env.STAGING_PARTICIPANT_STORAGE_STATE,
    });
  }

  test("reload keeps saved turns without duplicating them", async ({
    page,
  }) => {
    const interviewPath = process.env.STAGING_INTERVIEW_PATH ?? "";
    await page.goto(interviewPath);
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();

    const before = await page.getByTestId("message-user").count();
    await page.reload();
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await expect(page.getByTestId("message-user")).toHaveCount(before);
  });

  test("save reports failure instead of succeeding silently", async ({
    page,
  }) => {
    test.skip(
      process.env.STAGING_LIVE_CHAT !== "1",
      "Activa STAGING_LIVE_CHAT=1 para ejercitar Guardar contra la API real."
    );
    await page.goto(process.env.STAGING_INTERVIEW_PATH ?? "");
    await page.route("**/api/entrevista/guardar", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "No se pudo guardar el progreso" }),
        contentType: "application/json",
        status: 400,
      });
    });
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByText("No se pudo guardar el progreso")
    ).toBeVisible();
  });
});
