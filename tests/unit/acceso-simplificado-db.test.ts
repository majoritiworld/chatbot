import type { PGlite } from "@electric-sql/pglite";
import { expect, test } from "@playwright/test";
import { createTestDatabase } from "../support/database";

const PROYECTO = "21000000-0000-4000-8000-000000000001";
const OTRO_PROYECTO = "21000000-0000-4000-8000-000000000002";
const FASE_SOCIAS = "22000000-0000-4000-8000-000000000001";
const FASE_COLAB = "22000000-0000-4000-8000-000000000002";
const FASE_OTRA = "22000000-0000-4000-8000-000000000003";
const AMBAS = "23000000-0000-4000-8000-000000000001";
const COLAB = "23000000-0000-4000-8000-000000000002";
const AJENA = "23000000-0000-4000-8000-000000000003";
const E_SOCIAS = "24000000-0000-4000-8000-000000000001";
const E_AMBAS_COLAB = "24000000-0000-4000-8000-000000000002";
const E_COLAB = "24000000-0000-4000-8000-000000000003";
const E_AJENA = "24000000-0000-4000-8000-000000000004";
const SECCION = "25000000-0000-4000-8000-000000000001";
const TURNO = JSON.stringify([
  {
    at: "2026-09-30T00:00:00Z",
    id: "26000000-0000-4000-8000-000000000001",
    rol: "entrevistado",
    seccionId: SECCION,
    texto: "Respuesta ficticia",
  },
]);
let db: PGlite;

test.beforeAll(async () => {
  db = await createTestDatabase();
});
test.afterAll(async () => {
  await db?.close();
});
test.beforeEach(async () => {
  await db.exec(`
    RESET ROLE;
    TRUNCATE auth.users, public.proyecto CASCADE;
    INSERT INTO public.proyecto (id, nombre, cliente, slug) VALUES
      ('${PROYECTO}', 'CL', 'ComplianceLatam', 'compliance-latam'),
      ('${OTRO_PROYECTO}', 'Otra', 'Otra', 'otra-firma');
    INSERT INTO public.fase (id, proyecto_id, nombre, orden, acceso_solo_correo, acceso_enlace_personal) VALUES
      ('${FASE_SOCIAS}', '${PROYECTO}', 'Entrevistas a Firmas Socias', 2, true, false),
      ('${FASE_COLAB}', '${PROYECTO}', 'Entrevistas a colaboradores', 6, false, true),
      ('${FASE_OTRA}', '${OTRO_PROYECTO}', 'Entrevistas a Firmas Socias', 1, false, false);
    INSERT INTO public.stakeholder (id, proyecto_id, nombre, email) VALUES
      ('${AMBAS}', '${PROYECTO}', 'Ana', 'ambas@prueba.test'),
      ('${COLAB}', '${PROYECTO}', 'Carlos', 'colab@prueba.test'),
      ('${AJENA}', '${OTRO_PROYECTO}', 'Ana', 'ambas@prueba.test');
    INSERT INTO public.entrevista (id, stakeholder_id, secciones, flujo_estado) VALUES
      ('${E_SOCIAS}', '${AMBAS}', '[{"id":"${SECCION}","titulo":"T","preguntas":["P"]}]', 'chat'),
      ('${E_AMBAS_COLAB}', '${AMBAS}', '[{"id":"${SECCION}","titulo":"T","preguntas":["P"]}]', 'chat'),
      ('${E_COLAB}', '${COLAB}', '[{"id":"${SECCION}","titulo":"T","preguntas":["P"]}]', 'chat'),
      ('${E_AJENA}', '${AJENA}', '[{"id":"${SECCION}","titulo":"T","preguntas":["P"]}]', 'chat');
    INSERT INTO public.tarea (fase_id, entrevista_id, tipo) VALUES
      ('${FASE_SOCIAS}', '${E_SOCIAS}', 'entrevista'),
      ('${FASE_COLAB}', '${E_AMBAS_COLAB}', 'entrevista'),
      ('${FASE_COLAB}', '${E_COLAB}', 'entrevista'),
      ('${FASE_OTRA}', '${E_AJENA}', 'entrevista');
    INSERT INTO public.entrevista_enlace (entrevista_id, token_hash, token_cifrado) VALUES
      ('${E_AMBAS_COLAB}', 'hash-ambas', 'x'),
      ('${E_COLAB}', 'hash-colab', 'x');
  `);
});

async function comoServicio<T>(sql: string, params: unknown[]) {
  await db.exec("RESET ROLE; SET ROLE service_role");
  return await db.query<T>(sql, params);
}

async function guardarTurno(entrevistaId: string, email: string) {
  return await comoServicio(
    "SELECT public.append_interview_turns_enlace($1, $2, $3::jsonb)",
    [entrevistaId, email, TURNO]
  );
}

async function completar(entrevistaId: string) {
  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('app.interview_transition', 'allowed', false)"
  );
  await db.query(
    "UPDATE public.entrevista SET estado = 'completada' WHERE id = $1",
    [entrevistaId]
  );
  await db.query("SELECT set_config('app.interview_transition', '', false)");
}

async function marcarNotion(entrevistaId: string, email: string) {
  return await comoServicio(
    "SELECT public.mark_interview_notion_synced_enlace(p_entrevista_id => $1, p_page_id => 'pagina', p_email => $2)",
    [entrevistaId, email]
  );
}

test("email-only lookup returns only the flagged phase of that project", async () => {
  const lookup = (slug: string, email: string) =>
    comoServicio<{ entrevista_id: string; fase_id: string }>(
      "SELECT * FROM public.entrevistas_acceso_solo_correo($1, $2)",
      [slug, email]
    );
  expect(
    (await lookup("compliance-latam", "  AMBAS@Prueba.test ")).rows
  ).toEqual([{ entrevista_id: E_SOCIAS, fase_id: FASE_SOCIAS }]);
  expect((await lookup("compliance-latam", "colab@prueba.test")).rows).toEqual(
    []
  );
  expect((await lookup("compliance-latam", "nadie@prueba.test")).rows).toEqual(
    []
  );
  expect((await lookup("otra-firma", "ambas@prueba.test")).rows).toEqual([]);

  for (const rol of ["authenticated", "anon"]) {
    // biome-ignore lint/performance/noAwaitInLoops: one connection, the role must be set before the query
    await db.exec(`RESET ROLE; SET ROLE ${rol}`);
    await expect(
      db.query(
        "SELECT * FROM public.entrevistas_acceso_solo_correo('compliance-latam', 'ambas@prueba.test')"
      )
    ).rejects.toThrow(/permission denied/i);
  }
});

test("link wrappers save only with an active link or the email-only flag", async () => {
  await guardarTurno(E_COLAB, "colab@prueba.test");
  await guardarTurno(E_SOCIAS, "ambas@prueba.test");
  await expect(guardarTurno(E_COLAB, "ambas@prueba.test")).rejects.toThrow();
  await expect(guardarTurno(E_AJENA, "ambas@prueba.test")).rejects.toThrow();

  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE public.entrevista_enlace SET revocado_en = now() WHERE entrevista_id = $1",
    [E_COLAB]
  );
  await expect(guardarTurno(E_COLAB, "colab@prueba.test")).rejects.toThrow();

  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE public.fase SET acceso_solo_correo = false WHERE id = $1",
    [FASE_SOCIAS]
  );
  await expect(guardarTurno(E_SOCIAS, "ambas@prueba.test")).rejects.toThrow();

  await db.exec("RESET ROLE");
  const guardadas = await db.query<{ id: string; n: number }>(
    "SELECT id, jsonb_array_length(transcripcion) AS n FROM public.entrevista WHERE id IN ($1, $2) ORDER BY id",
    [E_SOCIAS, E_COLAB]
  );
  expect(guardadas.rows).toEqual([
    { id: E_SOCIAS, n: 1 },
    { id: E_COLAB, n: 1 },
  ]);
});

test("simplified session without a Supabase user persists consent and keeps answers", async () => {
  await guardarTurno(E_SOCIAS, "ambas@prueba.test");
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");

  const aceptar = (entrevistaId: string, email: string) =>
    comoServicio("SELECT public.accept_interview_consent_enlace($1, $2)", [
      entrevistaId,
      email,
    ]);

  await db.exec("RESET ROLE; SET ROLE authenticated");
  await expect(
    db.query("SELECT public.accept_interview_consent_enlace($1, $2)", [
      E_SOCIAS,
      "ambas@prueba.test",
    ])
  ).rejects.toThrow(/permission denied/i);
  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(
    db.query("SELECT public.accept_interview_consent($1)", [E_SOCIAS])
  ).rejects.toThrow(/permission denied/i);

  await aceptar(E_SOCIAS, "ambas@prueba.test");
  await expect(aceptar(E_SOCIAS, "colab@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await aceptar(E_COLAB, "colab@prueba.test");

  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE public.entrevista_enlace SET revocado_en = now() WHERE entrevista_id = $1",
    [E_COLAB]
  );
  await expect(aceptar(E_COLAB, "colab@prueba.test")).rejects.toThrow(
    /Interview not found/
  );

  await db.exec("RESET ROLE");
  const leer = () =>
    db.query<{ consentimiento: string | null; id: string; n: number }>(
      `SELECT id, consentimiento_en::text AS consentimiento, jsonb_array_length(transcripcion) AS n
       FROM public.entrevista ORDER BY id`
    );
  const antes = await leer();
  const socias = antes.rows.find((fila) => fila.id === E_SOCIAS);
  const colab = antes.rows.find((fila) => fila.id === E_COLAB);
  expect(socias).toMatchObject({ id: E_SOCIAS, n: 1 });
  expect(socias?.consentimiento).toBeTruthy();
  expect(colab?.consentimiento).toBeTruthy();
  expect(colab?.n).toBe(0);
  expect(antes.rows.find((fila) => fila.id === E_AMBAS_COLAB)).toMatchObject({
    consentimiento: null,
    n: 0,
  });
  expect(antes.rows.find((fila) => fila.id === E_AJENA)).toMatchObject({
    consentimiento: null,
    n: 0,
  });

  await aceptar(E_SOCIAS, "ambas@prueba.test");
  await db.exec("RESET ROLE");
  const despues = await leer();
  expect(despues.rows.find((fila) => fila.id === E_SOCIAS)).toEqual(socias);
});

test("email-only completion records the thank-you once, without a portal session", async () => {
  const marcar = (entrevistaId: string, email: string) =>
    comoServicio("SELECT public.mark_interview_thank_you_sent_enlace($1, $2)", [
      entrevistaId,
      email,
    ]);

  await expect(marcar(E_SOCIAS, "ambas@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await completar(E_SOCIAS);
  await expect(marcar(E_SOCIAS, "otra@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await marcar(E_SOCIAS, "ambas@prueba.test");

  await db.exec("RESET ROLE");
  const primero = await db.query<{ correo: string }>(
    "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
    [E_SOCIAS]
  );
  await marcar(E_SOCIAS, "ambas@prueba.test");
  await db.exec("RESET ROLE");
  const segundo = await db.query<{ correo: string }>(
    "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
    [E_SOCIAS]
  );
  expect(segundo.rows).toEqual(primero.rows);
  expect(primero.rows[0]?.correo).toBeTruthy();

  await db.exec("RESET ROLE; SET ROLE authenticated");
  await expect(
    db.query("SELECT public.mark_interview_thank_you_sent_enlace($1, $2)", [
      E_SOCIAS,
      "ambas@prueba.test",
    ])
  ).rejects.toThrow(/permission denied/i);
});

test("the Notion page links only to a completed interview of that participant", async () => {
  await expect(marcarNotion(E_COLAB, "colab@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await completar(E_COLAB);
  await completar(E_SOCIAS);
  await completar(E_AJENA);

  await expect(marcarNotion(E_COLAB, "ambas@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await expect(marcarNotion(E_AJENA, "ambas@prueba.test")).rejects.toThrow(
    /Interview not found/
  );
  await marcarNotion(E_COLAB, "colab@prueba.test");
  await marcarNotion(E_SOCIAS, "ambas@prueba.test");

  await db.exec("RESET ROLE");
  const filas = await db.query<{ id: string; notion: string | null }>(
    "SELECT id, notion_transcripcion_id AS notion FROM public.entrevista ORDER BY id"
  );
  expect(filas.rows).toEqual([
    { id: E_SOCIAS, notion: "pagina" },
    { id: E_AMBAS_COLAB, notion: null },
    { id: E_COLAB, notion: "pagina" },
    { id: E_AJENA, notion: null },
  ]);
});
