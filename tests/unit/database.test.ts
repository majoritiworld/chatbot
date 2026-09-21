import type { PGlite } from "@electric-sql/pglite";
import { expect, test } from "@playwright/test";
import { actAs, createTestDatabase } from "../support/database";

const ADMIN = "10000000-0000-4000-8000-000000000001";
const USER = "10000000-0000-4000-8000-000000000002";
const OTHER = "10000000-0000-4000-8000-000000000003";
const PROJECT = "20000000-0000-4000-8000-000000000001";
const STAKEHOLDER = "30000000-0000-4000-8000-000000000001";
const INTERVIEW = "40000000-0000-4000-8000-000000000001";
const SECTION = "50000000-0000-4000-8000-000000000001";
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
    INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
      ('${ADMIN}', 'admin@example.test', '{"role":"majoriti"}'),
      ('${USER}', 'participant@example.test', '{"role":"stakeholder"}'),
      ('${OTHER}', 'other@example.test', '{"role":"cliente"}');
    INSERT INTO public.proyecto (id, nombre, cliente) VALUES ('${PROJECT}', 'Test', 'Test');
    INSERT INTO public.stakeholder (id, proyecto_id, nombre, email)
      VALUES ('${STAKEHOLDER}', '${PROJECT}', 'Participant', 'participant@example.test');
    INSERT INTO public.entrevista (id, stakeholder_id, secciones, flujo_estado)
      VALUES ('${INTERVIEW}', '${STAKEHOLDER}',
        '[{"id":"${SECTION}","titulo":"Test","preguntas":["Pregunta"]}]', 'bienvenida');
  `);
  await actAs(db, USER, "participant@example.test");
});

test("participants can read their profile but cannot change their role or project", async () => {
  expect((await db.query("SELECT id FROM public.usuario")).rows).toHaveLength(
    1
  );
  const changed = await db.query(
    "UPDATE public.usuario SET rol = 'majoriti', proyecto_id = $1 WHERE id = $2 RETURNING id",
    [PROJECT, USER]
  );
  expect(changed.rows).toHaveLength(0);
  expect(
    (
      await db.query(
        "UPDATE public.usuario SET nombre = 'Hacked' WHERE id = $1 RETURNING id",
        [USER]
      )
    ).rows
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ rol: string }>(
        "SELECT rol FROM public.usuario WHERE id = $1",
        [USER]
      )
    ).rows[0].rol
  ).toBe("stakeholder");
});

test("participants cannot change another profile or insert a privileged profile", async () => {
  expect(
    (
      await db.query(
        "UPDATE public.usuario SET rol = 'majoriti' WHERE id = $1 RETURNING id",
        [OTHER]
      )
    ).rows
  ).toHaveLength(0);
  await expect(
    db.query(
      "INSERT INTO public.usuario (id, email, rol) VALUES (gen_random_uuid(), 'forged@example.test', 'majoriti')"
    )
  ).rejects.toThrow(/row-level security/);
});

test("Majoriti and the trusted service can still administer profiles", async () => {
  await actAs(db, ADMIN, "admin@example.test");
  expect(
    (
      await db.query(
        "UPDATE public.usuario SET proyecto_id = $1 WHERE id = $2 RETURNING id",
        [PROJECT, USER]
      )
    ).rows
  ).toHaveLength(1);
  await db.exec("RESET ROLE; SET ROLE service_role");
  expect(
    (
      await db.query(
        "UPDATE public.usuario SET nombre = 'Updated' WHERE id = $1 RETURNING id",
        [USER]
      )
    ).rows
  ).toHaveLength(1);
});

test("anonymous users cannot read profiles", async () => {
  await db.exec("RESET ROLE; SET ROLE anon");
  expect((await db.query("SELECT * FROM public.usuario")).rows).toHaveLength(0);
});

test("profile write policies are Majoriti-only after the restriction migration", async () => {
  const policies = await db.query<{ cmd: string; policyname: string }>(
    "SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usuario' ORDER BY policyname"
  );
  expect(policies.rows.map((row) => row.policyname)).toEqual([
    "usuario_all_majoriti",
    "usuario_select_self_or_majoriti",
  ]);
  expect(
    policies.rows.find((row) => row.policyname === "usuario_all_majoriti")?.cmd
  ).toBe("ALL");
});

async function advance() {
  await db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
    INTERVIEW,
  ]);
  await db.query("SELECT public.advance_interview_flow($1, 'presentacion')", [
    INTERVIEW,
  ]);
}

const completion = {
  hallazgos: [],
  modo: "agente",
  respuestas: [{ pregunta: "Pregunta", respuesta_texto: "Respuesta" }],
  seccionId: SECTION,
  sintesis: "Resumen",
};
const turn = {
  at: "2026-09-19T00:00:00Z",
  id: "60000000-0000-4000-8000-000000000001",
  rol: "entrevistado",
  seccionId: SECTION,
  texto: "Respuesta",
};

test("replayed transcript messages are stored once", async () => {
  await advance();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: replay only after the previous operation commits
    await db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify([turn]),
    ]);
  }
  const result = await db.query<{ transcripcion: unknown[] }>(
    "SELECT transcripcion FROM public.entrevista WHERE id = $1",
    [INTERVIEW]
  );
  expect(result.rows[0].transcripcion).toEqual([turn]);
});

test("silent close-offer turns persist by ID and survive a retry", async () => {
  await advance();
  const offer = {
    at: "2026-09-20T00:00:00Z",
    id: "60000000-0000-4000-8000-000000000099",
    ofertaCierre: true,
    rol: "entrevistador",
    seccionId: SECTION,
    texto: "\u200b",
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: retry must wait for the previous append
    await db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify([offer]),
    ]);
  }
  const result = await db.query<{
    transcripcion: Array<{ id: string; ofertaCierre?: boolean; texto: string }>;
  }>("SELECT transcripcion FROM public.entrevista WHERE id = $1", [INTERVIEW]);
  expect(result.rows[0].transcripcion).toHaveLength(1);
  expect(result.rows[0].transcripcion[0]).toMatchObject({
    id: offer.id,
    ofertaCierre: true,
    texto: "\u200b",
  });
});

test("two answers with the same text remain two turns when IDs differ", async () => {
  await advance();
  const first = turn;
  const second = {
    ...turn,
    id: "60000000-0000-4000-8000-000000000002",
  };
  await db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
    INTERVIEW,
    JSON.stringify([first, second]),
  ]);
  const result = await db.query<{ transcripcion: { id: string }[] }>(
    "SELECT transcripcion FROM public.entrevista WHERE id = $1",
    [INTERVIEW]
  );
  expect(result.rows[0].transcripcion.map((item) => item.id)).toEqual([
    first.id,
    second.id,
  ]);
});

test("repeated section completion and submit do not duplicate saved results", async () => {
  await advance();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: replay only after the previous operation commits
    await db.query(
      "SELECT public.complete_interview_section($1, $2, $3::jsonb, $4::jsonb)",
      [INTERVIEW, SECTION, JSON.stringify(completion), JSON.stringify([turn])]
    );
  }
  const section = await db.query<{
    seccion_actual: number;
    secciones_completadas: unknown[];
    transcripcion: unknown[];
  }>(
    "SELECT seccion_actual, secciones_completadas, transcripcion FROM public.entrevista WHERE id = $1",
    [INTERVIEW]
  );
  expect(section.rows[0].seccion_actual).toBe(1);
  expect(section.rows[0].secciones_completadas).toHaveLength(1);
  expect(section.rows[0].transcripcion).toHaveLength(1);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: replay only after the previous operation commits
    await db.query("SELECT public.submit_interview($1, $2::jsonb, $3::jsonb)", [
      INTERVIEW,
      JSON.stringify({ sintesis: "Resumen" }),
      JSON.stringify(completion.respuestas),
    ]);
  }
  expect(
    (
      await db.query(
        "SELECT * FROM public.respuesta WHERE entrevista_id = $1",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(2);
});

test("another user cannot append, advance or complete this interview", async () => {
  await actAs(db, OTHER, "other@example.test");
  await expect(
    db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify([turn]),
    ])
  ).rejects.toThrow();
  await expect(
    db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
      INTERVIEW,
    ])
  ).rejects.toThrow();
  await expect(
    db.query(
      "SELECT public.complete_interview_section($1, $2, $3::jsonb, '[]')",
      [INTERVIEW, SECTION, JSON.stringify(completion)]
    )
  ).rejects.toThrow();
});

test("participants cannot bypass the flow with a direct update or premature submit", async () => {
  await expect(
    db.query(
      "UPDATE public.entrevista SET estado = 'completada' WHERE id = $1",
      [INTERVIEW]
    )
  ).rejects.toThrow(/validated transitions/);
  await expect(
    db.query("SELECT public.submit_interview($1, '{}', '[]')", [INTERVIEW])
  ).rejects.toThrow(/not ready/);
});

test("transcript rows stay visible to the owner and same-project client, not to other projects", async () => {
  const secreto = "SECRETO-TRANSCRIPCION-AJENA";
  const otherProject = "20000000-0000-4000-8000-000000000002";
  const otherClient = "10000000-0000-4000-8000-000000000004";

  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE public.entrevista SET transcripcion = $1::jsonb WHERE id = $2",
    [JSON.stringify([{ texto: secreto }]), INTERVIEW]
  );
  await db.query("UPDATE public.usuario SET proyecto_id = $1 WHERE id = $2", [
    PROJECT,
    OTHER,
  ]);
  await db.query(
    "INSERT INTO public.proyecto (id, nombre, cliente) VALUES ($1, 'Other', 'Other')",
    [otherProject]
  );
  await db.query(
    "INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES ($1, 'cross@example.test', '{\"role\":\"cliente\"}')",
    [otherClient]
  );
  await db.query("UPDATE public.usuario SET proyecto_id = $1 WHERE id = $2", [
    otherProject,
    otherClient,
  ]);

  await actAs(db, USER, "participant@example.test");
  expect(
    (
      await db.query<{ transcripcion: { texto: string }[] }>(
        "SELECT transcripcion FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.transcripcion[0]?.texto
  ).toBe(secreto);

  await actAs(db, OTHER, "other@example.test");
  expect(
    (
      await db.query<{ transcripcion: { texto: string }[] }>(
        "SELECT transcripcion FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.transcripcion[0]?.texto
  ).toBe(secreto);

  await actAs(db, otherClient, "cross@example.test");
  expect(
    (
      await db.query(
        "SELECT transcripcion FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(0);
});
