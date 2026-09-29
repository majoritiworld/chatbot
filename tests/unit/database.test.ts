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
  expect(
    (
      await db.query(
        "UPDATE public.stakeholder SET estado_entrevista = 'pendiente' WHERE id = $1 RETURNING id",
        [STAKEHOLDER]
      )
    ).rows
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ estado_entrevista: string }>(
        "SELECT estado_entrevista FROM public.stakeholder WHERE id = $1",
        [STAKEHOLDER]
      )
    ).rows[0]?.estado_entrevista
  ).toBe("completada");
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

test("Majoriti can delete an interview and its answers; participants cannot", async () => {
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO public.respuesta (entrevista_id, pregunta, respuesta_texto) VALUES ($1, 'P', 'R')",
    [INTERVIEW]
  );

  await actAs(db, USER, "participant@example.test");
  expect(
    (
      await db.query(
        "DELETE FROM public.entrevista WHERE id = $1 RETURNING id",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(0);

  await db.exec("RESET ROLE");
  await actAs(db, ADMIN, "admin@example.test");
  expect(
    (
      await db.query(
        "DELETE FROM public.entrevista WHERE id = $1 RETURNING id",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(1);

  await db.exec("RESET ROLE");
  expect(
    (
      await db.query("SELECT id FROM public.entrevista WHERE id = $1", [
        INTERVIEW,
      ])
    ).rows
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "SELECT id FROM public.respuesta WHERE entrevista_id = $1",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(0);
  expect(
    (
      await db.query("SELECT id FROM public.stakeholder WHERE id = $1", [
        STAKEHOLDER,
      ])
    ).rows
  ).toHaveLength(1);
});

test("participants cannot bypass the flow with a direct update or premature submit", async () => {
  await expect(
    db.query(
      "UPDATE public.entrevista SET estado = 'completada' WHERE id = $1",
      [INTERVIEW]
    )
  ).rejects.toThrow(/validated transitions/);
  await expect(
    db.query(
      "UPDATE public.entrevista SET notion_transcripcion_id = 'page' WHERE id = $1",
      [INTERVIEW]
    )
  ).rejects.toThrow(/validated transitions/);
  await expect(
    db.query("SELECT public.submit_interview($1, '{}', '[]')", [INTERVIEW])
  ).rejects.toThrow(/not ready/);
});

test("Notion page id is written only through the sync RPC", async () => {
  await expect(
    db.query("SELECT public.mark_interview_notion_synced($1, 'page-1')", [
      INTERVIEW,
    ])
  ).rejects.toThrow(/Interview not found/);

  await db.exec("RESET ROLE");
  await actAs(db, ADMIN, "admin@example.test");
  await db.query(
    "UPDATE public.entrevista SET estado = 'completada' WHERE id = $1",
    [INTERVIEW]
  );

  await db.exec("RESET ROLE");
  await actAs(db, USER, "participant@example.test");
  await db.query("SELECT public.mark_interview_notion_synced($1, 'page-1')", [
    INTERVIEW,
  ]);
  expect(
    (
      await db.query<{ notion_transcripcion_id: string }>(
        "SELECT notion_transcripcion_id FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0].notion_transcripcion_id
  ).toBe("page-1");

  await db.query("SELECT public.mark_interview_notion_synced($1, 'page-2')", [
    INTERVIEW,
  ]);
  expect(
    (
      await db.query<{ notion_transcripcion_id: string }>(
        "SELECT notion_transcripcion_id FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0].notion_transcripcion_id
  ).toBe("page-1");

  await db.exec("RESET ROLE");
  await actAs(db, OTHER, "other@example.test");
  await expect(
    db.query("SELECT public.mark_interview_notion_synced($1, 'page-3')", [
      INTERVIEW,
    ])
  ).rejects.toThrow();
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

test("calendar tokens stay hidden from portal users", async () => {
  await db.exec("RESET ROLE; SET ROLE service_role");
  await db.query(
    `INSERT INTO public.calendario_google (usuario_id, email, refresh_token)
     VALUES ($1, 'admin@example.test', 'cifrado')`,
    [ADMIN]
  );
  await actAs(db, USER, "participant@example.test");
  expect(
    (await db.query("SELECT usuario_id FROM public.calendario_google")).rows
  ).toHaveLength(0);
  await expect(
    db.query(
      `INSERT INTO public.calendario_google (usuario_id, email, refresh_token)
       VALUES ($1, 'x@example.test', 'no')`,
      [USER]
    )
  ).rejects.toThrow(/row-level security/);
});

test("one email can answer two projects and cannot cross into a third", async () => {
  const projectB = "20000000-0000-4000-8000-000000000002";
  const projectC = "20000000-0000-4000-8000-000000000003";
  const stakeholderB = "30000000-0000-4000-8000-000000000002";
  const stakeholderC = "30000000-0000-4000-8000-000000000003";
  const interviewB = "40000000-0000-4000-8000-000000000002";
  const interviewC = "40000000-0000-4000-8000-000000000003";
  const sectionB = "50000000-0000-4000-8000-000000000002";

  await db.exec("RESET ROLE");
  await db.query(
    `INSERT INTO public.proyecto (id, nombre, cliente, slug, nombre_publico)
     VALUES ($1, 'B', 'Cliente B', 'cliente-b', 'Cliente B'),
            ($2, 'C', 'Cliente C', 'cliente-c', 'Cliente C')`,
    [projectB, projectC]
  );
  await db.query(
    `INSERT INTO public.stakeholder (id, proyecto_id, nombre, email)
     VALUES ($1, $2, 'Participant', 'participant@example.test'),
            ($3, $4, 'Other', 'other@example.test')`,
    [stakeholderB, projectB, stakeholderC, projectC]
  );
  await expect(
    db.query(
      `INSERT INTO public.stakeholder (proyecto_id, nombre, email)
       VALUES ($1, 'Dup', 'participant@example.test')`,
      [PROJECT]
    )
  ).rejects.toThrow(/duplicate key|unique/i);
  await db.query(
    `INSERT INTO public.entrevista (id, stakeholder_id, secciones, flujo_estado)
     VALUES ($1, $2, $3::jsonb, 'bienvenida'),
            ($4, $5, $3::jsonb, 'bienvenida')`,
    [
      interviewB,
      stakeholderB,
      JSON.stringify([{ id: sectionB, preguntas: ["Pregunta"], titulo: "B" }]),
      interviewC,
      stakeholderC,
    ]
  );

  await actAs(db, USER, "participant@example.test");
  expect(
    (
      await db.query(
        "SELECT id FROM public.entrevista WHERE id = ANY($1::uuid[])",
        [[INTERVIEW, interviewB]]
      )
    ).rows
  ).toHaveLength(2);
  expect(
    (
      await db.query("SELECT id FROM public.entrevista WHERE id = $1", [
        interviewC,
      ])
    ).rows
  ).toHaveLength(0);
  await db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
    interviewB,
  ]);
  await db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
    interviewB,
    JSON.stringify([
      {
        ...turn,
        id: "60000000-0000-4000-8000-000000000002",
        seccionId: sectionB,
      },
    ]),
  ]);
  await expect(
    db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      interviewC,
      JSON.stringify([turn]),
    ])
  ).rejects.toThrow();

  await db.exec("RESET ROLE; SET ROLE anon");
  expect(
    (await db.query("SELECT id FROM public.proyecto_acceso")).rows
  ).toHaveLength(0);
  expect(
    (await db.query("SELECT email FROM public.stakeholder")).rows
  ).toHaveLength(0);
  expect(
    (await db.query("SELECT slug, nombre_publico FROM public.proyecto")).rows
  ).toHaveLength(0);
});

test("reloading existing permissions keeps roles and in-progress interviews", async () => {
  const projectB = "20000000-0000-4000-8000-000000000012";
  const stakeholderB = "30000000-0000-4000-8000-000000000012";
  const interviewB = "40000000-0000-4000-8000-000000000012";
  const clientOnly = "10000000-0000-4000-8000-000000000012";
  const crossUser = "10000000-0000-4000-8000-000000000013";
  const crossStakeholder = "30000000-0000-4000-8000-000000000013";

  await db.exec("RESET ROLE");
  try {
    await db.exec(
      "ALTER TABLE public.stakeholder DISABLE TRIGGER stakeholder_sync_proyecto_acceso"
    );
    await db.exec("DELETE FROM public.proyecto_acceso");
    await db.query(
      `UPDATE public.usuario
     SET rol = 'cliente', proyecto_id = $1, email = 'Participant@Example.test'
     WHERE id = $2`,
      [PROJECT, USER]
    );
    await db.query(
      "UPDATE public.stakeholder SET email = ' Participant@Example.test ' WHERE id = $1",
      [STAKEHOLDER]
    );
    await db.query(
      `INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
      ($1, 'solo-cliente@example.test', '{"role":"cliente"}'),
      ($2, 'cruzado@example.test', '{"role":"cliente"}')`,
      [clientOnly, crossUser]
    );
    await db.query(
      `UPDATE public.usuario SET rol = 'cliente', proyecto_id = $1 WHERE id = $2`,
      [PROJECT, clientOnly]
    );
    await db.query(
      `INSERT INTO public.proyecto (id, nombre, cliente) VALUES ($1, 'Ajeno', 'Ajeno')`,
      [projectB]
    );
    await db.query(
      `UPDATE public.usuario SET rol = 'cliente', proyecto_id = $1 WHERE id = $2`,
      [PROJECT, crossUser]
    );
    await db.query(
      `INSERT INTO public.stakeholder (id, proyecto_id, nombre, email) VALUES
      ($1, $2, 'Ajeno', 'other@example.test'),
      ($3, $2, 'Cruzado', 'cruzado@example.test')`,
      [stakeholderB, projectB, crossStakeholder]
    );
    await db.query(
      `INSERT INTO public.entrevista (id, stakeholder_id, secciones, flujo_estado)
     VALUES ($1, $2, '[{"id":"sec-b","titulo":"B","preguntas":["Q"]}]', 'bienvenida')`,
      [interviewB, stakeholderB]
    );
    const antes = await db.query<{
      estado: string;
      flujo_estado: string;
    }>("SELECT estado, flujo_estado FROM public.entrevista WHERE id = $1", [
      INTERVIEW,
    ]);

    await db.query("SELECT private.cargar_proyecto_acceso()");
    const primera = await db.query<{
      email: string;
      id: string;
      proyecto_id: string;
      rol: string;
    }>(
      "SELECT id, proyecto_id, email, rol FROM public.proyecto_acceso ORDER BY email, proyecto_id"
    );
    await db.query("SELECT private.cargar_proyecto_acceso()");
    const segunda = await db.query<{
      email: string;
      id: string;
      proyecto_id: string;
      rol: string;
    }>(
      "SELECT id, proyecto_id, email, rol FROM public.proyecto_acceso ORDER BY email, proyecto_id"
    );

    expect(segunda.rows).toEqual(primera.rows);
    expect(
      primera.rows.filter((fila) => fila.email === "participant@example.test")
    ).toEqual([
      expect.objectContaining({
        email: "participant@example.test",
        proyecto_id: PROJECT,
        rol: "cliente",
      }),
    ]);
    expect(
      primera.rows.some(
        (fila) =>
          fila.email === "participant@example.test" &&
          fila.proyecto_id === projectB
      )
    ).toBe(false);
    expect(
      primera.rows.find((fila) => fila.email === "solo-cliente@example.test")
    ).toMatchObject({ proyecto_id: PROJECT, rol: "cliente" });
    expect(
      primera.rows
        .filter((fila) => fila.email === "cruzado@example.test")
        .map((fila) => ({ proyecto_id: fila.proyecto_id, rol: fila.rol }))
        .sort((a, b) => a.rol.localeCompare(b.rol))
    ).toEqual([
      { proyecto_id: PROJECT, rol: "cliente" },
      { proyecto_id: projectB, rol: "stakeholder" },
    ]);
    const despues = await db.query<{ estado: string; flujo_estado: string }>(
      "SELECT estado, flujo_estado FROM public.entrevista WHERE id = $1",
      [INTERVIEW]
    );
    expect(despues.rows).toEqual(antes.rows);

    await db.query(
      `UPDATE public.proyecto_acceso SET rol = 'stakeholder'
     WHERE email = 'participant@example.test' AND proyecto_id = $1`,
      [PROJECT]
    );
    await db.query("SELECT private.cargar_proyecto_acceso()");
    expect(
      (
        await db.query<{ rol: string }>(
          `SELECT rol FROM public.proyecto_acceso
         WHERE email = 'participant@example.test' AND proyecto_id = $1`,
          [PROJECT]
        )
      ).rows[0]?.rol
    ).toBe("stakeholder");

    await db.exec(
      "ALTER TABLE public.stakeholder ENABLE TRIGGER stakeholder_sync_proyecto_acceso"
    );
    await db.query(
      `UPDATE public.proyecto_acceso SET rol = 'cliente'
     WHERE email = 'participant@example.test' AND proyecto_id = $1`,
      [PROJECT]
    );
    await db.query(
      "UPDATE public.stakeholder SET proyecto_id = $1 WHERE id = $2",
      [projectB, STAKEHOLDER]
    );
    const accesoParticipante = await db.query<{
      proyecto_id: string;
      rol: string;
    }>(
      `SELECT proyecto_id, rol FROM public.proyecto_acceso
     WHERE email = 'participant@example.test' ORDER BY proyecto_id`
    );
    expect(accesoParticipante.rows).toEqual([
      { proyecto_id: PROJECT, rol: "cliente" },
      { proyecto_id: projectB, rol: "stakeholder" },
    ]);

    await db.query(
      "UPDATE public.stakeholder SET proyecto_id = $1 WHERE id = $2",
      [PROJECT, STAKEHOLDER]
    );
    await actAs(db, USER, "participant@example.test");
    expect(
      (
        await db.query("SELECT id FROM public.entrevista WHERE id = $1", [
          INTERVIEW,
        ])
      ).rows
    ).toHaveLength(1);
    await db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
      INTERVIEW,
    ]);
    expect(
      (
        await db.query("SELECT id FROM public.entrevista WHERE id = $1", [
          interviewB,
        ])
      ).rows
    ).toHaveLength(0);
    await expect(
      db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
        interviewB,
        JSON.stringify([turn]),
      ])
    ).rejects.toThrow();

    await actAs(db, crossUser, "cruzado@example.test");
    expect(
      (
        await db.query("SELECT id FROM public.entrevista WHERE id = $1", [
          interviewB,
        ])
      ).rows
    ).toHaveLength(0);
    await db.exec("RESET ROLE; SET ROLE authenticated");
    await expect(
      db.query("SELECT private.cargar_proyecto_acceso()")
    ).rejects.toThrow(/permission denied/i);
  } finally {
    await db.exec("RESET ROLE");
    await db.exec(
      "ALTER TABLE public.stakeholder ENABLE TRIGGER stakeholder_sync_proyecto_acceso"
    );
  }
});

test("interview RPCs require the session user, not a browser email claim", async () => {
  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [
      OTHER,
      JSON.stringify({
        email: "participant@example.test",
        role: "authenticated",
        sub: OTHER,
      }),
    ]
  );
  await db.exec("SET ROLE authenticated");
  await expect(
    db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify([turn]),
    ])
  ).rejects.toThrow(/Invalid interview turns/);
  await expect(
    db.query(
      "SELECT public.complete_interview_section($1, $2, $3::jsonb, '[]')",
      [INTERVIEW, SECTION, JSON.stringify(completion)]
    )
  ).rejects.toThrow(/Interview not found/);
  await expect(
    db.query("SELECT public.submit_interview($1, '{}', '[]')", [INTERVIEW])
  ).rejects.toThrow(/Interview not found/);

  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', $1, false)",
    [
      JSON.stringify({
        email: "participant@example.test",
        role: "authenticated",
      }),
    ]
  );
  await db.exec("SET ROLE authenticated");
  await expect(
    db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify([turn]),
    ])
  ).rejects.toThrow(/Invalid interview turns/);

  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(
    db.query("SELECT public.append_interview_turns($1, '[]'::jsonb)", [
      INTERVIEW,
    ])
  ).rejects.toThrow(/permission denied/i);
  await db.exec("RESET ROLE; SET ROLE service_role");
  await expect(
    db.query("SELECT public.submit_interview($1, '{}', '[]')", [INTERVIEW])
  ).rejects.toThrow(/permission denied/i);

  await actAs(db, ADMIN, "admin@example.test");
  await db.query("SELECT public.append_interview_turns($1, $2::jsonb)", [
    INTERVIEW,
    JSON.stringify([turn]),
  ]);
  expect(
    (
      await db.query<{ n: number }>(
        "SELECT jsonb_array_length(transcripcion) AS n FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.n
  ).toBe(1);
  expect(
    (
      await db.query(
        "SELECT id FROM public.stakeholder WHERE id <> $1 AND estado_entrevista <> 'pendiente'",
        [STAKEHOLDER]
      )
    ).rows
  ).toHaveLength(0);
});

test("flow RPCs and own stakeholder id ignore a forged email claim", async () => {
  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [
      OTHER,
      JSON.stringify({
        email: "participant@example.test",
        role: "authenticated",
        sub: OTHER,
      }),
    ]
  );
  await db.exec("SET ROLE authenticated");
  expect(
    (
      await db.query<{ id: string | null }>(
        "SELECT private.own_stakeholder_id() AS id"
      )
    ).rows[0]?.id
  ).toBeNull();
  await expect(
    db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
      INTERVIEW,
    ])
  ).rejects.toThrow(/Interview not found/);
  expect(
    (
      await db.query<{ flujo_estado: string }>(
        "SELECT flujo_estado FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.flujo_estado
  ).toBe("bienvenida");

  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [
      USER,
      JSON.stringify({
        email: "other@example.test",
        role: "authenticated",
        sub: USER,
      }),
    ]
  );
  await db.exec("SET ROLE authenticated");
  expect(
    (
      await db.query<{ id: string | null }>(
        "SELECT private.own_stakeholder_id() AS id"
      )
    ).rows[0]?.id
  ).toBe(STAKEHOLDER);
  await db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
    INTERVIEW,
  ]);

  await actAs(db, ADMIN, "admin@example.test");
  await db.query("SELECT public.advance_interview_flow($1, 'presentacion')", [
    INTERVIEW,
  ]);
  expect(
    (
      await db.query<{ flujo_estado: string }>(
        "SELECT flujo_estado FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.flujo_estado
  ).toBe("chat");

  await actAs(db, OTHER, "other@example.test");
  await expect(
    db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
      INTERVIEW,
    ])
  ).rejects.toThrow(/Interview not found/);

  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(
    db.query("SELECT public.advance_interview_flow($1, 'bienvenida')", [
      INTERVIEW,
    ])
  ).rejects.toThrow(/permission denied/i);
  await db.exec("RESET ROLE; SET ROLE service_role");
  await expect(
    db.query("SELECT public.mark_interview_thank_you_sent($1)", [INTERVIEW])
  ).rejects.toThrow(/permission denied/i);

  await db.exec("RESET ROLE");
  await db.query(
    `DO $$
     BEGIN
       PERFORM set_config('app.interview_transition', 'allowed', true);
       UPDATE public.entrevista
       SET estado = 'completada', fecha_completada = now()
       WHERE id = '${INTERVIEW}';
     END $$;`
  );

  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [
      OTHER,
      JSON.stringify({
        email: "participant@example.test",
        role: "authenticated",
        sub: OTHER,
      }),
    ]
  );
  await db.exec("SET ROLE authenticated");
  await expect(
    db.query("SELECT public.mark_interview_thank_you_sent($1)", [INTERVIEW])
  ).rejects.toThrow(/Interview not found/);
  expect(
    (
      await db.query<{ correo: string | null }>(
        "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.correo
  ).toBeNull();

  await actAs(db, USER, "participant@example.test");
  await db.query("SELECT public.mark_interview_thank_you_sent($1)", [
    INTERVIEW,
  ]);
  const correo = (
    await db.query<{ correo: string | null }>(
      "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
      [INTERVIEW]
    )
  ).rows[0]?.correo;
  expect(correo).toBeTruthy();

  await actAs(db, ADMIN, "admin@example.test");
  await db.query("SELECT public.mark_interview_thank_you_sent($1)", [
    INTERVIEW,
  ]);
  expect(
    (
      await db.query<{ correo: string | null }>(
        "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
        [INTERVIEW]
      )
    ).rows[0]?.correo
  ).toBe(correo);
});

const citaParticipante = "En la práctica las firmas no comparten casos.";
const fraseEntrevistador = "¿Qué evidencia concreta observó en el último año?";

async function entregarConCita() {
  await advance();
  await db.query(
    "SELECT public.complete_interview_section($1, $2, $3::jsonb, $4::jsonb)",
    [
      INTERVIEW,
      SECTION,
      JSON.stringify(completion),
      JSON.stringify([
        {
          at: "2026-09-19T00:00:00Z",
          id: "60000000-0000-4000-8000-000000000010",
          rol: "entrevistador",
          seccionId: SECTION,
          texto: fraseEntrevistador,
        },
        {
          at: "2026-09-19T00:00:01Z",
          id: "60000000-0000-4000-8000-000000000011",
          rol: "entrevistado",
          seccionId: SECTION,
          texto: `\u200b${citaParticipante}`,
        },
      ]),
    ]
  );
  await db.query("SELECT public.submit_interview($1, $2::jsonb, $3::jsonb)", [
    INTERVIEW,
    JSON.stringify({ hallazgos: [], respuestas: [], sintesis: "Resumen" }),
    JSON.stringify(completion.respuestas),
  ]);
}

test("consultation summary stores only literal participant quotes", async () => {
  await expect(
    db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify({
        citas: [citaParticipante],
        sintesis: "Antes de enviar",
      }),
    ])
  ).rejects.toThrow(/not submitted|Interview not found/i);

  await entregarConCita();
  await expect(
    db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify({
        citas: ["Las firmas casi no comparten casos."],
        sintesis: "Reformulado",
      }),
    ])
  ).rejects.toThrow(/Quote is not literal/);
  await expect(
    db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify({
        citas: [fraseEntrevistador],
        sintesis: "Cita del entrevistador",
      }),
    ])
  ).rejects.toThrow(/Quote is not literal/);

  await db.query("SELECT public.mark_interview_thank_you_sent($1)", [
    INTERVIEW,
  ]);
  const correoAntes = (
    await db.query<{ correo: string }>(
      "SELECT correo_agradecimiento_en::text AS correo FROM public.entrevista WHERE id = $1",
      [INTERVIEW]
    )
  ).rows[0]?.correo;
  await db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
    INTERVIEW,
    JSON.stringify({
      citas: [citaParticipante],
      sintesis: "  Las firmas no comparten casos.  ",
    }),
  ]);
  await db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
    INTERVIEW,
    JSON.stringify({
      citas: [citaParticipante],
      sintesis: "Un segundo resumen que no debe guardarse",
    }),
  ]);

  const guardada = await db.query<{
    correo: string;
    estado: string;
    resumen: {
      consulta: { citas: string[]; sintesis: string };
      sintesis: string;
    };
  }>(
    `SELECT estado, correo_agradecimiento_en::text AS correo, resumen
     FROM public.entrevista WHERE id = $1`,
    [INTERVIEW]
  );
  expect(guardada.rows[0]?.estado).toBe("completada");
  expect(guardada.rows[0]?.correo).toBe(correoAntes);
  expect(guardada.rows[0]?.resumen.sintesis).toBe("Resumen");
  expect(guardada.rows[0]?.resumen.consulta).toEqual({
    citas: [citaParticipante],
    sintesis: "Las firmas no comparten casos.",
  });
  expect(
    (
      await db.query(
        "SELECT id FROM public.respuesta WHERE entrevista_id = $1",
        [INTERVIEW]
      )
    ).rows
  ).toHaveLength(2);
});

test("a same-project client can save the consultation summary once", async () => {
  await entregarConCita();
  await actAs(db, OTHER, "other@example.test");
  await expect(
    db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
      INTERVIEW,
      JSON.stringify({ citas: [citaParticipante], sintesis: "Ajeno" }),
    ])
  ).rejects.toThrow(/Interview not found/);

  await db.exec("RESET ROLE");
  await db.query("UPDATE public.usuario SET proyecto_id = $1 WHERE id = $2", [
    PROJECT,
    OTHER,
  ]);
  await actAs(db, OTHER, "other@example.test");
  await db.query("SELECT public.guardar_sintesis_consulta($1, $2::jsonb)", [
    INTERVIEW,
    JSON.stringify({
      citas: [],
      sintesis: "Síntesis del cliente lector",
    }),
  ]);
  const guardada = await db.query<{
    resumen: { consulta: { citas: string[]; sintesis: string } };
  }>("SELECT resumen FROM public.entrevista WHERE id = $1", [INTERVIEW]);
  expect(guardada.rows[0]?.resumen.consulta.sintesis).toBe(
    "Síntesis del cliente lector"
  );
  expect(guardada.rows[0]?.resumen.consulta.citas).toEqual([]);
});

test("country and job title can be stored without becoming a permission", async () => {
  await db.exec("RESET ROLE");
  await db.query(
    "UPDATE public.stakeholder SET pais = 'Norte', cargo = 'Socia' WHERE id = $1",
    [STAKEHOLDER]
  );
  const fase1 = await db.query<{ id: string }>(
    `INSERT INTO public.entrevista (stakeholder_id, preguntas)
     VALUES ($1, '["fase-1-intacta"]'::jsonb)
     RETURNING id`,
    [STAKEHOLDER]
  );
  await db.query(
    `INSERT INTO public.entrevista (stakeholder_id, preguntas)
     VALUES ($1, '["fase-2-nueva"]')`,
    [STAKEHOLDER]
  );
  await expect(
    db.query(
      `INSERT INTO public.stakeholder (proyecto_id, nombre, email, pais, cargo)
       VALUES ($1, 'Cara', 'participant@example.test', 'Sur', 'Socio')`,
      [PROJECT]
    )
  ).rejects.toThrow(/duplicate key|unique/i);

  const guardada = await db.query<{
    cargo: string;
    pais: string;
    preguntas: string[];
    rol: string;
  }>(
    `SELECT s.pais, s.cargo, u.rol, e.preguntas
     FROM public.stakeholder s
     JOIN public.usuario u ON lower(u.email) = lower(s.email)
     JOIN public.entrevista e ON e.id = $2
     WHERE s.id = $1`,
    [STAKEHOLDER, fase1.rows[0]?.id]
  );
  expect(guardada.rows[0]).toMatchObject({
    cargo: "Socia",
    pais: "Norte",
    preguntas: ["fase-1-intacta"],
    rol: "stakeholder",
  });
});

test("a google event can belong to only one portal date", async () => {
  await db.exec("RESET ROLE; SET ROLE service_role");
  await db.query(
    `INSERT INTO public.evento (proyecto_id, titulo, fecha, google_event_id)
     VALUES ($1, 'Kickoff', '2026-09-22', 'evt-1')`,
    [PROJECT]
  );
  await expect(
    db.query(
      `INSERT INTO public.evento (proyecto_id, titulo, fecha, google_event_id)
       VALUES ($1, 'Otra', '2026-09-23', 'evt-1')`,
      [PROJECT]
    )
  ).rejects.toThrow(/duplicate key|unique/i);
});
