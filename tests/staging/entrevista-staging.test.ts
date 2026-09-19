import { expect, test } from "@playwright/test";
import { withRestoredProyectoId } from "../support/restore-proyecto";
import { exigirCuentasDePrueba } from "../support/staging-accounts";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en .env.staging.local`);
  }
  return value;
}

const configured = Boolean(
  process.env.STAGING_BASE_URL &&
    process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_PARTICIPANT_ACCESS_TOKEN &&
    process.env.STAGING_OTHER_ACCESS_TOKEN &&
    process.env.STAGING_MAJORITI_ACCESS_TOKEN &&
    process.env.STAGING_PARTICIPANT_ID &&
    process.env.STAGING_OTHER_ID &&
    process.env.STAGING_PROJECT_ID &&
    process.env.STAGING_PARTICIPANT_EMAIL &&
    process.env.STAGING_OTHER_EMAIL &&
    process.env.STAGING_MAJORITI_EMAIL
);

test.describe("Staging interview protections", () => {
  test.skip(
    !configured,
    "Copia .env.staging.example a .env.staging.local con cuentas *@example.test."
  );

  function rest(
    path: string,
    {
      body,
      method = "GET",
      prefer,
      token,
    }: {
      body?: unknown;
      method?: string;
      prefer?: string;
      token: string;
    }
  ) {
    const url = required("STAGING_SUPABASE_URL");
    const anonKey = required("STAGING_SUPABASE_ANON_KEY");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    };
    if (prefer) {
      headers.Prefer = prefer;
    }
    return fetch(`${url}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
    });
  }

  test.beforeAll(() => {
    if (!configured) {
      return;
    }
    exigirCuentasDePrueba({
      majoritiEmail: required("STAGING_MAJORITI_EMAIL"),
      otherEmail: required("STAGING_OTHER_EMAIL"),
      participantEmail: required("STAGING_PARTICIPANT_EMAIL"),
    });
  });

  test("a participant cannot change their role, project or another profile", async () => {
    const token = required("STAGING_PARTICIPANT_ACCESS_TOKEN");
    const self = required("STAGING_PARTICIPANT_ID");
    const other = required("STAGING_OTHER_ID");
    const projectId = required("STAGING_PROJECT_ID");

    const selfUpdate = await rest(`/rest/v1/usuario?id=eq.${self}`, {
      body: { proyecto_id: projectId, rol: "majoriti" },
      method: "PATCH",
      prefer: "return=representation",
      token,
    });
    expect(selfUpdate.status).toBe(200);
    expect(await selfUpdate.json()).toEqual([]);

    const otherUpdate = await rest(`/rest/v1/usuario?id=eq.${other}`, {
      body: { rol: "majoriti" },
      method: "PATCH",
      prefer: "return=representation",
      token,
    });
    expect(otherUpdate.status).toBe(200);
    expect(await otherUpdate.json()).toEqual([]);
  });

  test("Majoriti can still assign a test profile to a project", async () => {
    const token = required("STAGING_MAJORITI_ACCESS_TOKEN");
    const participant = required("STAGING_PARTICIPANT_ID");
    const projectId = required("STAGING_PROJECT_ID");

    const getProyectoId = async (userId: string) => {
      const response = await rest(
        `/rest/v1/usuario?id=eq.${userId}&select=proyecto_id`,
        { token }
      );
      expect(response.ok).toBe(true);
      const rows = (await response.json()) as Array<{
        proyecto_id: string | null;
      }>;
      return rows[0]?.proyecto_id ?? null;
    };
    const setProyectoId = async (userId: string, proyectoId: string | null) => {
      const response = await rest(`/rest/v1/usuario?id=eq.${userId}`, {
        body: { proyecto_id: proyectoId },
        method: "PATCH",
        prefer: "return=minimal",
        token,
      });
      if (!response.ok) {
        throw new Error(
          `No se pudo actualizar proyecto_id (${response.status})`
        );
      }
    };

    await withRestoredProyectoId({
      getProyectoId,
      nextProyectoId: projectId,
      setProyectoId,
      userId: participant,
    });
  });
});
