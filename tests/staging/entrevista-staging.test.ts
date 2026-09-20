import { expect, test } from "@playwright/test";
import { withRestoredProyectoId } from "../support/restore-proyecto";
import {
  cuentasDesdeEntorno,
  exigirSesionAutorizada,
} from "../support/staging-accounts";
import { entrevistaIdDesdeRuta } from "../support/staging-entrevista-ui";

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
    process.env.STAGING_ALLOWED_EMAILS &&
    process.env.STAGING_ALLOWED_IDS &&
    process.env.STAGING_PARTICIPANT_ACCESS_TOKEN &&
    process.env.STAGING_OTHER_ACCESS_TOKEN &&
    process.env.STAGING_MAJORITI_ACCESS_TOKEN &&
    process.env.STAGING_PARTICIPANT_ID &&
    process.env.STAGING_OTHER_ID &&
    process.env.STAGING_MAJORITI_ID &&
    process.env.STAGING_PROJECT_ID &&
    process.env.STAGING_PARTICIPANT_EMAIL &&
    process.env.STAGING_OTHER_EMAIL &&
    process.env.STAGING_MAJORITI_EMAIL
);

test.describe("Staging interview protections", () => {
  test.skip(
    !configured,
    "Copia .env.staging.example a .env.staging.local con tres cuentas exclusivas de prueba."
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

  async function exigirPerfilAutorizado(
    token: string,
    expected: { email: string; id: string }
  ) {
    const response = await rest(
      `/rest/v1/usuario?id=eq.${expected.id}&select=id,email`,
      { token }
    );
    expect(response.ok).toBe(true);
    const rows = (await response.json()) as Array<{
      email?: string;
      id?: string;
    }>;
    const row = rows.at(0);
    expect(row?.id).toBe(expected.id);
    expect(row?.email?.toLowerCase()).toBe(expected.email.toLowerCase());
  }

  test.beforeAll(async () => {
    if (!configured) {
      return;
    }
    const cuentas = cuentasDesdeEntorno();
    const anonKey = required("STAGING_SUPABASE_ANON_KEY");
    const supabaseUrl = required("STAGING_SUPABASE_URL");
    await Promise.all([
      exigirSesionAutorizada({
        anonKey,
        expected: cuentas.participant,
        supabaseUrl,
        token: required("STAGING_PARTICIPANT_ACCESS_TOKEN"),
      }),
      exigirSesionAutorizada({
        anonKey,
        expected: cuentas.other,
        supabaseUrl,
        token: required("STAGING_OTHER_ACCESS_TOKEN"),
      }),
      exigirSesionAutorizada({
        anonKey,
        expected: cuentas.majoriti,
        supabaseUrl,
        token: required("STAGING_MAJORITI_ACCESS_TOKEN"),
      }),
    ]);
  });

  test("a participant cannot change their role, project or another profile", async () => {
    const token = required("STAGING_PARTICIPANT_ACCESS_TOKEN");
    const cuentas = cuentasDesdeEntorno();
    await exigirSesionAutorizada({
      anonKey: required("STAGING_SUPABASE_ANON_KEY"),
      expected: cuentas.participant,
      supabaseUrl: required("STAGING_SUPABASE_URL"),
      token,
    });
    await exigirPerfilAutorizado(token, cuentas.participant);

    const selfUpdate = await rest(
      `/rest/v1/usuario?id=eq.${cuentas.participant.id}`,
      {
        body: {
          proyecto_id: required("STAGING_PROJECT_ID"),
          rol: "majoriti",
        },
        method: "PATCH",
        prefer: "return=representation",
        token,
      }
    );
    expect(selfUpdate.status).toBe(200);
    expect(await selfUpdate.json()).toEqual([]);

    const otherUpdate = await rest(
      `/rest/v1/usuario?id=eq.${cuentas.other.id}`,
      {
        body: { rol: "majoriti" },
        method: "PATCH",
        prefer: "return=representation",
        token,
      }
    );
    expect(otherUpdate.status).toBe(200);
    expect(await otherUpdate.json()).toEqual([]);
  });

  test("Majoriti can still assign a test profile to a project", async () => {
    const token = required("STAGING_MAJORITI_ACCESS_TOKEN");
    const cuentas = cuentasDesdeEntorno();
    const projectId = required("STAGING_PROJECT_ID");
    await exigirSesionAutorizada({
      anonKey: required("STAGING_SUPABASE_ANON_KEY"),
      expected: cuentas.majoriti,
      supabaseUrl: required("STAGING_SUPABASE_URL"),
      token,
    });
    await exigirPerfilAutorizado(token, cuentas.participant);

    const getProyectoId = async (userId: string) => {
      const response = await rest(
        `/rest/v1/usuario?id=eq.${userId}&select=proyecto_id`,
        { token }
      );
      expect(response.ok).toBe(true);
      const rows = (await response.json()) as Array<{
        proyecto_id: string | null;
      }>;
      return rows.at(0)?.proyecto_id ?? null;
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
      userId: cuentas.participant.id,
    });
  });

  test("another account cannot read or close a foreign interview", async () => {
    const interviewId = entrevistaIdDesdeRuta(
      process.env.STAGING_INTERVIEW_PATH ?? ""
    );
    test.skip(
      !interviewId,
      "Define STAGING_INTERVIEW_PATH con una entrevista QA."
    );
    const otherToken = required("STAGING_OTHER_ACCESS_TOKEN");
    const own = await rest(
      `/rest/v1/entrevista?id=eq.${interviewId}&select=id`,
      { token: otherToken }
    );
    expect(own.ok).toBe(true);
    expect(await own.json()).toEqual([]);

    const close = await rest("/rest/v1/rpc/complete_interview_section", {
      body: {
        p_completion: {
          completadaEn: new Date().toISOString(),
          hallazgos: [],
          modo: "manual",
          respuestas: [],
          seccionId: "00000000-0000-4000-8000-000000000000",
          sintesis: "intento ajeno",
        },
        p_entrevista_id: interviewId,
        p_seccion_id: "00000000-0000-4000-8000-000000000000",
        p_transcripcion: [],
      },
      method: "POST",
      token: otherToken,
    });
    expect(close.ok).toBe(false);
  });
});
