import { config } from "dotenv";
import {
  ASUNTO_INVITACION_CL_COLABORADORES,
  CUERPO_INVITACION_CL_COLABORADORES,
  NOMBRE_FASE_COLABORADORES,
} from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import {
  EMAIL_PRUEBA_COLABORADORES,
  ENTREVISTA_PRUEBA_COLABORADORES,
} from "@/lib/consultoria/invitacion-colaboradores";
import { createAdminClient } from "@/lib/supabase/admin";

config({ path: ".env.local" });

const ENTREVISTA_ANTERIOR = "1190524f-79e3-49e8-b090-7000711d21ad";
const ENTREVISTA_FIRMAS = "1bd0ab9f-30b9-437e-a1b3-fef57ea56fc3";
const NOTION_FIRMAS = "3eb31b45-3629-8197-b8c9-e470c12c1e56";
const FASE_COLABORADORES = "e332c5bb-d1b7-459d-9261-4906646bb9f7";
const NOMBRE_PLANTILLA_PRUEBA =
  "PRUEBA · Entrevista a colaboradores — ComplianceLatam";

function escribir(linea: string) {
  process.stdout.write(`${linea}\n`);
}

function turnos(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

type Marca = {
  consentimiento_en: string | null;
  estado: string;
  flujo_estado: string | null;
  notion_transcripcion_id: string | null;
  turnos: number;
};

function marcaDe(fila: {
  consentimiento_en: string | null;
  estado: string;
  flujo_estado: string | null;
  notion_transcripcion_id: string | null;
  transcripcion: unknown;
}): Marca {
  return {
    consentimiento_en: fila.consentimiento_en,
    estado: fila.estado,
    flujo_estado: fila.flujo_estado,
    notion_transcripcion_id: fila.notion_transcripcion_id,
    turnos: turnos(fila.transcripcion),
  };
}

async function leerMarca(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  id: string
) {
  const { data, error } = await admin
    .from("entrevista")
    .select(
      "id, estado, flujo_estado, consentimiento_en, notion_transcripcion_id, transcripcion"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("No está la entrevista que hay que conservar.");
  }
  return marcaDe(data);
}

function exigirIgual(antes: Marca, despues: Marca, etiqueta: string) {
  if (JSON.stringify(antes) !== JSON.stringify(despues)) {
    throw new Error(`Cambió ${etiqueta}. Se detiene la preparación.`);
  }
}

async function main() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("No hay cliente administrativo.");
  }

  const firmasAntes = await leerMarca(admin, ENTREVISTA_FIRMAS);
  const anteriorAntes = await leerMarca(admin, ENTREVISTA_ANTERIOR);
  if (firmasAntes.notion_transcripcion_id !== NOTION_FIRMAS) {
    throw new Error("La transcripción de firmas socias no es la esperada.");
  }

  const { data: anterior, error: errorAnterior } = await admin
    .from("entrevista")
    .select(
      "id, plantilla_id, stakeholder:stakeholder_id(id, email), plantilla:plantilla_id(id, fase_id, proyecto_id, preguntas, secciones, instrucciones_agente, trato)"
    )
    .eq("id", ENTREVISTA_ANTERIOR)
    .single();
  if (errorAnterior || !anterior) {
    throw errorAnterior ?? new Error("No está la prueba anterior.");
  }
  const stakeholder = Array.isArray(anterior.stakeholder)
    ? anterior.stakeholder[0]
    : anterior.stakeholder;
  const plantilla = Array.isArray(anterior.plantilla)
    ? anterior.plantilla[0]
    : anterior.plantilla;
  if (stakeholder?.email?.trim().toLowerCase() !== EMAIL_PRUEBA_COLABORADORES) {
    throw new Error(
      "La prueba anterior no pertenece al destinatario autorizado."
    );
  }
  if (!(plantilla && stakeholder)) {
    throw new Error("La prueba anterior no tiene plantilla o identidad.");
  }
  if (plantilla.fase_id !== FASE_COLABORADORES) {
    throw new Error("La prueba anterior no está en la fase de colaboradores.");
  }

  const { error: errorFase } = await admin
    .from("fase")
    .update({
      invitacion_asunto: ASUNTO_INVITACION_CL_COLABORADORES,
      invitacion_cuerpo: CUERPO_INVITACION_CL_COLABORADORES,
    })
    .eq("id", FASE_COLABORADORES)
    .eq("nombre", NOMBRE_FASE_COLABORADORES);
  if (errorFase) {
    throw errorFase;
  }

  const { data: plantillaPrueba } = await admin
    .from("entrevista_plantilla")
    .select("id")
    .eq("fase_id", FASE_COLABORADORES)
    .eq("nombre", NOMBRE_PLANTILLA_PRUEBA)
    .maybeSingle();
  let plantillaPruebaId = plantillaPrueba?.id ?? null;
  if (!plantillaPruebaId) {
    const { data: creada, error } = await admin
      .from("entrevista_plantilla")
      .insert({
        fase_id: plantilla.fase_id,
        instrucciones_agente: plantilla.instrucciones_agente,
        nombre: NOMBRE_PLANTILLA_PRUEBA,
        preguntas: plantilla.preguntas,
        proyecto_id: plantilla.proyecto_id,
        secciones: plantilla.secciones,
        trato: plantilla.trato,
      })
      .select("id")
      .single();
    if (error || !creada) {
      throw (
        error ?? new Error("No se pudo copiar la plantilla de colaboradores.")
      );
    }
    plantillaPruebaId = creada.id;
  }

  const { data: existente } = await admin
    .from("entrevista")
    .select(
      "id, estado, flujo_estado, consentimiento_en, transcripcion, stakeholder_id"
    )
    .eq("id", ENTREVISTA_PRUEBA_COLABORADORES)
    .maybeSingle();
  if (existente) {
    if (
      existente.estado !== "abierta" ||
      existente.flujo_estado !== "bienvenida" ||
      existente.consentimiento_en ||
      turnos(existente.transcripcion) > 0 ||
      existente.stakeholder_id !== stakeholder.id
    ) {
      throw new Error("La asignación nueva ya no está sin iniciar.");
    }
  } else {
    const { error } = await admin.from("entrevista").insert({
      consentimiento_en: null,
      estado: "abierta",
      flujo_estado: "bienvenida",
      id: ENTREVISTA_PRUEBA_COLABORADORES,
      instrucciones_agente: plantilla.instrucciones_agente,
      plantilla_id: plantillaPruebaId,
      preguntas: plantilla.preguntas,
      seccion_actual: 0,
      secciones: plantilla.secciones,
      secciones_completadas: [],
      stakeholder_id: stakeholder.id,
      transcripcion: [],
      trato: plantilla.trato,
    });
    if (error) {
      throw error;
    }
  }

  const { data: tarea } = await admin
    .from("tarea")
    .select("id")
    .eq("fase_id", FASE_COLABORADORES)
    .eq("entrevista_id", ENTREVISTA_PRUEBA_COLABORADORES)
    .eq("tipo", "entrevista")
    .maybeSingle();
  if (!tarea) {
    const { error } = await admin.from("tarea").insert({
      entrevista_id: ENTREVISTA_PRUEBA_COLABORADORES,
      estado: "pendiente",
      fase_id: FASE_COLABORADORES,
      responsable: "PRUEBA Seba",
      tipo: "entrevista",
    });
    if (error) {
      throw error;
    }
  }

  exigirIgual(
    anteriorAntes,
    await leerMarca(admin, ENTREVISTA_ANTERIOR),
    "la prueba anterior"
  );
  exigirIgual(
    firmasAntes,
    await leerMarca(admin, ENTREVISTA_FIRMAS),
    "firmas socias"
  );

  const { data: firmasFase } = await admin
    .from("fase")
    .select("invitacion_asunto, invitacion_cuerpo")
    .eq("nombre", "Entrevistas a Firmas Socias")
    .maybeSingle();
  if (firmasFase?.invitacion_asunto || firmasFase?.invitacion_cuerpo) {
    throw new Error(
      "La fase de firmas socias recibió el texto de colaboradores."
    );
  }

  escribir(`asignacion=${ENTREVISTA_PRUEBA_COLABORADORES}`);
  escribir("estado=abierta flujo=bienvenida respuestas=0");
  escribir("anterior=conservada firmas=intactas");
}
main().catch((error: unknown) => {
  const mensaje =
    error instanceof Error ? error.message : "No se pudo preparar";
  process.stderr.write(`${mensaje}\n`);
  process.exitCode = 1;
});
