import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  cuentasDesdeEntorno,
  exigirSesionAutorizada,
  extraerAccessToken,
} from "../support/staging-accounts";
import {
  abrirEntrevista,
  bloquearEnvioEntrevista,
  descartarTour,
  entrevistaIdDesdeRuta,
  SAVE_FAILED,
  snapshotEntrevista,
  turnosConTexto,
} from "../support/staging-entrevista-ui";

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

  test.beforeEach(async ({ page }) => {
    await bloquearEnvioEntrevista(page);
  });

  test("reload keeps saved turns without duplicating them", async ({
    page,
  }) => {
    await abrirEntrevista(page);
    const completa = page.getByText("Entrevista completa");
    if (await completa.isVisible().catch(() => false)) {
      await expect(completa).toBeVisible();
      return;
    }
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();
    const before = await page.getByTestId("message-user").count();
    await page.reload();
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await expect(page.getByTestId("message-user")).toHaveCount(before);
  });

  test("failed persist shows one error, retry keeps the original turn, reload matches the database", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const entrevistaId = entrevistaIdDesdeRuta(
      process.env.STAGING_INTERVIEW_PATH ?? ""
    );
    const beforeDb = await snapshotEntrevista(entrevistaId);
    if (beforeDb.flujo_estado !== "chat") {
      throw new Error(
        "Esta prueba necesita la entrevista de QA en flujo chat para persistir POST /api/chat."
      );
    }

    const marker = `QA-persist-${Date.now()}`;
    let rejected = false;
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const body = route.request().postData() ?? "";
      if (!rejected && body.includes(marker)) {
        rejected = true;
        await route.fulfill({
          body: JSON.stringify({
            code: "save_failed:chat",
            message: SAVE_FAILED,
          }),
          contentType: "application/json",
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await abrirEntrevista(page);
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await descartarTour(page);

    const input = page.getByTestId("multimodal-input");
    await input.fill(marker);
    await page.getByTestId("send-button").click();

    const avisos = page.getByTestId("toast").filter({ hasText: SAVE_FAILED });
    await expect(avisos).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId("retry-send-button")).toBeVisible();

    const failedTurn = page
      .getByTestId("message-user")
      .filter({ hasText: marker });
    await expect(failedTurn).toHaveCount(1);
    const originalId = await failedTurn.getAttribute("data-message-id");
    expect(originalId).toBeTruthy();

    await page.getByTestId("retry-send-button").click();
    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 90_000,
    });
    await expect(failedTurn).toHaveCount(1);
    await expect(failedTurn).toHaveAttribute(
      "data-message-id",
      originalId ?? ""
    );

    await page.reload();
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
    await descartarTour(page);
    const afterReload = page
      .getByTestId("message-user")
      .filter({ hasText: marker });
    await expect(afterReload).toHaveCount(1);
    await expect(afterReload).toHaveAttribute(
      "data-message-id",
      originalId ?? ""
    );

    const afterDb = await snapshotEntrevista(entrevistaId);
    const persisted = turnosConTexto(afterDb.transcripcion, marker);
    expect(persisted).toHaveLength(1);
    expect(persisted.at(0)?.id).toBe(originalId);
  });

  test("closing the last section keeps the final screen after reload without duplicating results", async ({
    page,
  }) => {
    // Distinct from tests/unit/database.test.ts, which covers RPC
    // complete_interview_section / submit_interview idempotency.
    const entrevistaId = entrevistaIdDesdeRuta(
      process.env.STAGING_INTERVIEW_PATH ?? ""
    );
    await abrirEntrevista(page);
    await expect(page.getByText("Entrevista completa")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Enviar entrevista" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Enviar$/ })).toHaveCount(0);

    const before = await snapshotEntrevista(entrevistaId);
    expect(before.flujo_estado).toBe("revision");
    const completed = before.secciones_completadas.length;

    await page.reload();
    await expect(page.getByText("Entrevista completa")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar entrevista" })
    ).toBeVisible();

    const after = await snapshotEntrevista(entrevistaId);
    expect(after.flujo_estado).toBe("revision");
    expect(after.secciones_completadas).toHaveLength(completed);
  });
});
