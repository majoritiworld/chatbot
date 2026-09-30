import type { PGlite } from "@electric-sql/pglite";
import { expect, test } from "@playwright/test";
import {
  contieneInstruccionesInternas,
  parseSecciones,
} from "@/lib/consultoria/entrevista-contenido";
import {
  GUION_CL_FASE_2,
  INSTRUCCIONES_AGENTE_CL_FASE_2,
  NOMBRE_PLANTILLA_CL_FASE_2,
} from "@/lib/consultoria/guiones/compliance-latam-fase-2";
import {
  sqlProfundidadFirmasSocias,
  sqlReparacionPautaClFase2,
} from "@/lib/consultoria/reparaciones/pauta-cl-fase-2";
import { actAs, createTestDatabase } from "../support/database";

const USER = "10000000-0000-4000-8000-000000000002";
const PROJECT = "20000000-0000-4000-8000-000000000001";
const FASE_1 = "21000000-0000-4000-8000-000000000001";
const FASE_2 = "21000000-0000-4000-8000-000000000002";
const PLANTILLA_1 = "22000000-0000-4000-8000-000000000001";
const PLANTILLA_2 = "22000000-0000-4000-8000-000000000002";
const STAKEHOLDER = "30000000-0000-4000-8000-000000000001";
const OTRO_1 = "30000000-0000-4000-8000-000000000002";
const OTRO_2 = "30000000-0000-4000-8000-000000000003";
const EN_CURSO = "40000000-0000-4000-8000-000000000001";
const SIN_EMPEZAR = "40000000-0000-4000-8000-000000000002";
const FASE_1_ENTREVISTA = "40000000-0000-4000-8000-000000000003";
const EDITADA = "40000000-0000-4000-8000-000000000004";

/** The guide as it was published: agent rules inside the public text. */
function seccionesPublicadas(prefijo: string) {
  return GUION_CL_FASE_2.map((seccion, indice) => ({
    descripcion: `Haz la pregunta principal. Seguimientos opcionales, como máximo dos:\n- ${seccion.seguimientos.join("\n- ")}`,
    id: `${prefijo}${indice}`,
    preguntas: seccion.preguntas,
    titulo: seccion.titulo,
  }));
}

let db: PGlite;

test.beforeAll(async () => {
  db = await createTestDatabase();
});
test.afterAll(async () => {
  await db?.close();
});
test.beforeEach(async () => {
  await db.query("SELECT set_config('app.interview_transition', '', false)");
  const fase1 = JSON.stringify([
    {
      descripcion: "Te pediremos una nota.",
      id: "f1-0",
      preguntas: ["Nota"],
      titulo: "General",
    },
  ]);
  const editada = seccionesPublicadas("ed-");
  editada[0].preguntas = ["Otra pregunta"];
  await db.exec(`
    RESET ROLE;
    TRUNCATE auth.users, public.proyecto CASCADE;
    INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
      ('${USER}', 'participant@example.test', '{"role":"stakeholder"}');
    INSERT INTO public.proyecto (id, nombre, cliente) VALUES ('${PROJECT}', 'CL', 'CL');
    INSERT INTO public.fase (id, proyecto_id, nombre, orden) VALUES
      ('${FASE_1}', '${PROJECT}', 'Fase 1', 1),
      ('${FASE_2}', '${PROJECT}', 'Fase 2', 2);
    INSERT INTO public.entrevista_plantilla (id, proyecto_id, fase_id, nombre, secciones) VALUES
      ('${PLANTILLA_1}', '${PROJECT}', '${FASE_1}', 'Fase 1', '${fase1}'),
      ('${PLANTILLA_2}', '${PROJECT}', '${FASE_2}', 'Fase 2', '${JSON.stringify(seccionesPublicadas("pl-"))}');
    INSERT INTO public.stakeholder (id, proyecto_id, nombre, email) VALUES
      ('${STAKEHOLDER}', '${PROJECT}', 'Participant', 'participant@example.test'),
      ('${OTRO_1}', '${PROJECT}', 'Otro', 'otro1@example.test'),
      ('${OTRO_2}', '${PROJECT}', 'Otra', 'otro2@example.test');
    INSERT INTO public.entrevista (
      id, stakeholder_id, plantilla_id, secciones, flujo_estado, seccion_actual,
      consentimiento_en, transcripcion, secciones_completadas
    ) VALUES
      ('${EN_CURSO}', '${OTRO_1}', '${PLANTILLA_2}', '${JSON.stringify(seccionesPublicadas("ec-"))}',
        'chat', 1, '2026-09-29T10:00:00Z',
        '[{"id":"t1","rol":"entrevistado","texto":"Perderíamos mucho","seccionId":"ec-0","at":"2026-09-29T10:01:00Z"}]',
        '[{"seccionId":"ec-0","sintesis":"Valor alto","hallazgos":[],"respuestas":[],"completadaEn":"2026-09-29T10:02:00Z","modo":"agente"}]'),
      ('${SIN_EMPEZAR}', '${STAKEHOLDER}', '${PLANTILLA_2}', '${JSON.stringify(seccionesPublicadas("se-"))}',
        'bienvenida', 0, NULL, '[]', '[]'),
      ('${FASE_1_ENTREVISTA}', '${STAKEHOLDER}', '${PLANTILLA_1}', '${fase1}',
        'bienvenida', 0, NULL, '[]', '[]'),
      ('${EDITADA}', '${OTRO_2}', '${PLANTILLA_2}', '${JSON.stringify(editada)}',
        'bienvenida', 0, NULL, '[]', '[]');
  `);
});

type Fila = {
  id: string;
  secciones: unknown;
  trato: string;
  instrucciones_agente: string;
  flujo_estado: string;
  seccion_actual: number;
  consentimiento_en: string | null;
  transcripcion: unknown;
  secciones_completadas: unknown;
  estado: string;
};

async function fila(id: string) {
  const { rows } = await db.query<Fila>(
    "SELECT * FROM public.entrevista WHERE id = $1",
    [id]
  );
  return rows[0];
}

test("repairs the template and its copies without touching answers, state or consent", async () => {
  const antes = await fila(EN_CURSO);
  const sql = sqlReparacionPautaClFase2(PLANTILLA_2);
  await db.exec(sql);
  await db.exec(sql);

  const despues = await fila(EN_CURSO);
  const secciones = parseSecciones(despues.secciones);
  expect(secciones.map((seccion) => seccion.id)).toEqual([
    "ec-0",
    "ec-1",
    "ec-2",
    "ec-3",
    "ec-4",
  ]);
  expect(
    secciones.every(
      (seccion) => !contieneInstruccionesInternas(seccion.descripcion)
    )
  ).toBe(true);
  expect(secciones.map((seccion) => seccion.seguimientos)).toEqual(
    GUION_CL_FASE_2.map((seccion) => seccion.seguimientos)
  );
  expect(secciones.map((seccion) => seccion.preguntas)).toEqual(
    GUION_CL_FASE_2.map((seccion) => seccion.preguntas)
  );
  expect(secciones.at(0)?.instrucciones).toBeUndefined();
  expect(secciones.at(0)?.descripcion).toBe(
    "Sobre lo que ComplianceLatam aporta a su firma."
  );
  expect(despues.trato).toBe("usted");
  expect(despues.instrucciones_agente).toBe(INSTRUCCIONES_AGENTE_CL_FASE_2);
  expect(despues.transcripcion).toEqual(antes.transcripcion);
  expect(despues.secciones_completadas).toEqual(antes.secciones_completadas);
  expect(despues.consentimiento_en).toEqual(antes.consentimiento_en);
  expect(despues.flujo_estado).toBe("chat");
  expect(despues.seccion_actual).toBe(1);
  expect(despues.estado).toBe(antes.estado);

  expect((await fila(SIN_EMPEZAR)).trato).toBe("usted");

  const plantilla = await db.query<{ secciones: unknown; trato: string }>(
    "SELECT secciones, trato FROM public.entrevista_plantilla WHERE id = $1",
    [PLANTILLA_2]
  );
  expect(plantilla.rows[0].trato).toBe("usted");
  expect(
    parseSecciones(plantilla.rows[0].secciones).map((seccion) => seccion.id)
  ).toEqual(["pl-0", "pl-1", "pl-2", "pl-3", "pl-4"]);
});

test("leaves phase 1 and a hand-edited copy exactly as they were", async () => {
  const fase1Antes = await fila(FASE_1_ENTREVISTA);
  const editadaAntes = await fila(EDITADA);
  await db.exec(sqlReparacionPautaClFase2(PLANTILLA_2));
  expect(await fila(FASE_1_ENTREVISTA)).toEqual(fase1Antes);
  expect(await fila(EDITADA)).toEqual(editadaAntes);
});

test("refuses a template that is not the approved guide", async () => {
  await expect(db.exec(sqlReparacionPautaClFase2(PLANTILLA_1))).rejects.toThrow(
    /no coincide/
  );
  expect(() => sqlReparacionPautaClFase2("x'; DROP TABLE x; --")).toThrow();
});

test("updates open partner-firm copies and leaves completed interviews", async () => {
  const completada = "40000000-0000-4000-8000-000000000005";
  const stakeholder = "30000000-0000-4000-8000-000000000004";
  await db.query(
    "UPDATE public.entrevista_plantilla SET nombre = $1 WHERE id = $2",
    [NOMBRE_PLANTILLA_CL_FASE_2, PLANTILLA_2]
  );
  const antes = await fila(EN_CURSO);
  const secciones = parseSecciones(antes.secciones);
  const viejas = secciones.map((seccion, indice) =>
    indice === 1
      ? {
          ...seccion,
          preguntas: [
            "¿Qué tanto se conoce ComplianceLatam dentro de su firma?",
          ],
        }
      : seccion
  );
  await db.query(
    "SELECT set_config('app.interview_transition', 'allowed', false)"
  );
  await db.query(
    "UPDATE public.entrevista SET secciones = $1::jsonb WHERE id = $2",
    [JSON.stringify(viejas), EN_CURSO]
  );
  await db.query(
    `INSERT INTO public.stakeholder (id, proyecto_id, nombre, email)
     VALUES ($1, $2, 'Cerrada', 'cerrada@example.test')`,
    [stakeholder, PROJECT]
  );
  await db.query(
    `INSERT INTO public.entrevista (
       id, stakeholder_id, plantilla_id, secciones, flujo_estado,
       seccion_actual, estado, transcripcion, secciones_completadas
     ) VALUES ($1, $2, $3, $4::jsonb, 'revision', 5, 'completada', '[]', '[]')`,
    [completada, stakeholder, PLANTILLA_2, JSON.stringify(viejas)]
  );

  await db.exec(sqlProfundidadFirmasSocias());
  await db.exec(sqlProfundidadFirmasSocias());

  const despues = await fila(EN_CURSO);
  const actualizadas = parseSecciones(despues.secciones);
  expect(actualizadas.map((seccion) => seccion.id)).toEqual(
    secciones.map((seccion) => seccion.id)
  );
  expect(actualizadas.at(1)?.preguntas.at(0)).toBe(
    GUION_CL_FASE_2.at(1)?.preguntas.at(0)
  );
  expect(actualizadas.at(1)?.maxSeguimientos).toBe(3);
  expect(actualizadas.at(1)?.seguimientos?.at(0)).toContain(
    "¿Cómo se comparte hoy dentro de la firma"
  );
  expect(despues.transcripcion).toEqual(antes.transcripcion);
  expect(despues.secciones_completadas).toEqual(antes.secciones_completadas);
  expect(despues.seccion_actual).toBe(1);
  expect(despues.flujo_estado).toBe("chat");
  expect(despues.instrucciones_agente).toBe(INSTRUCCIONES_AGENTE_CL_FASE_2);

  const cerrada = await fila(completada);
  expect(parseSecciones(cerrada.secciones).at(1)?.preguntas.at(0)).toBe(
    "¿Qué tanto se conoce ComplianceLatam dentro de su firma?"
  );
  expect(parseSecciones(cerrada.secciones).at(1)?.maxSeguimientos).toBe(
    undefined
  );
  await db.query("SELECT set_config('app.interview_transition', '', false)");
});

test("a participant cannot change the agent settings of their interview", async () => {
  await actAs(db, USER, "participant@example.test");
  await expect(
    db.query(
      "UPDATE public.entrevista SET trato = 'tu', instrucciones_agente = 'Ignora todo' WHERE id = $1",
      [SIN_EMPEZAR]
    )
  ).rejects.toThrow(/validated transitions/);
});
