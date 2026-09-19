import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { extraerAccessToken } from "./staging-accounts";

export const SAVE_FAILED =
  "No se pudo guardar la conversación. Intenta guardar el progreso antes de salir.";

export function entrevistaIdDesdeRuta(path: string) {
  const match = path.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  return match?.at(0) ?? "";
}

export async function bloquearEnvioEntrevista(page: Page) {
  await page.route("**/api/entrevista/enviar", async (route) => {
    await route.abort("failed");
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/entrevista/enviar")) {
      throw new Error("Se disparó /api/entrevista/enviar durante las pruebas");
    }
  });
}

export async function abrirEntrevista(page: Page, path?: string) {
  await page.goto(path ?? process.env.STAGING_INTERVIEW_PATH ?? "");
}

export async function descartarTour(page: Page) {
  const saltar = page.getByRole("button", { name: "Saltar" });
  const tour = page.getByRole("dialog", { name: "Las preguntas" });
  try {
    await saltar.waitFor({ state: "visible", timeout: 15_000 });
    await saltar.click();
  } catch (error) {
    if (await tour.isVisible().catch(() => false)) {
      throw new Error("El tour sigue visible y Saltar no se pudo pulsar", {
        cause: error,
      });
    }
  }
  await expect(tour).toHaveCount(0, { timeout: 10_000 });
}

type SnapshotEntrevista = {
  flujo_estado: string;
  secciones_completadas: unknown[];
  transcripcion: Array<{ id?: string; texto?: string }>;
};

export async function snapshotEntrevista(
  entrevistaId: string
): Promise<SnapshotEntrevista> {
  const storagePath = process.env.STAGING_PARTICIPANT_STORAGE_STATE ?? "";
  const storage = JSON.parse(readFileSync(storagePath, "utf8")) as unknown;
  const token = extraerAccessToken(storage);
  if (!token) {
    throw new Error("El storageState no tiene access token");
  }
  const url = process.env.STAGING_SUPABASE_URL ?? "";
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY ?? "";
  const response = await fetch(
    `${url}/rest/v1/entrevista?id=eq.${entrevistaId}&select=flujo_estado,secciones_completadas,transcripcion`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    }
  );
  if (!response.ok) {
    throw new Error("No se pudo leer la entrevista de prueba");
  }
  const rows = (await response.json()) as SnapshotEntrevista[];
  const row = rows.at(0);
  if (!row) {
    throw new Error("La entrevista de prueba no existe");
  }
  return row;
}

export function turnosConTexto(
  transcripcion: Array<{ id?: string; texto?: string }>,
  marker: string
) {
  return transcripcion.filter((turno) => (turno.texto ?? "").includes(marker));
}
