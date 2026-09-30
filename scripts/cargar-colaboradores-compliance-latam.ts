import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planificarColaboradores } from "@/lib/consultoria/cargas/compliance-latam-colaboradores";
import { preguntasDeSecciones } from "@/lib/consultoria/entrevista-contenido";
import {
  INSTRUCCIONES_AGENTE_CL_COLABORADORES,
  MINUTOS_CL_COLABORADORES,
  NOMBRE_FASE_COLABORADORES,
  NOMBRE_PLANTILLA_CL_COLABORADORES,
  seccionesDeGuionClColaboradores,
  TRATO_CL_COLABORADORES,
} from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import { esProyectoComplianceLatam } from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import { cifrarSecreto } from "@/lib/consultoria/token-cifrado";
import { createAdminClient } from "@/lib/supabase/admin";

/** Copy of this phase only. The common template adds access and saving notes. */
const ASUNTO_INVITACION_COLABORADORES =
  "Su experiencia con ComplianceLatam: entrevista de 15 minutos";

const CUERPO_INVITACION_COLABORADORES = [
  "Desde ComplianceLatam queremos conocer su experiencia con la red y entender cómo podemos ser más útiles en su trabajo.",
  "Le invitamos a una entrevista individual de aproximadamente 15 minutos en la plataforma Majoriti. Su perspectiva nos sirve incluso si hasta ahora ha participado poco o no ha utilizado la red.",
  "Puede guardar su avance y continuar más adelante desde este mismo enlace.",
  "Muchas gracias por su tiempo.",
].join("\n\n");

const PLANILLA =
  process.argv[2] ?? "/Users/salbagli/Downloads/Planilla Majoriti.xlsx";
const REPORTE = path.join(process.cwd(), ".local", "carga-colaboradores.json");

type Linea = {
  consolidado: boolean;
  fila: number;
  hoja: string;
  pendiente: boolean;
  resultado: string;
  valido: boolean;
};

function cargarEntorno() {
  const archivo = path.join(process.cwd(), ".env.local");
  let texto = "";
  try {
    texto = readFileSync(archivo, "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#") || !limpia.includes("=")) {
      continue;
    }
    const corte = limpia.indexOf("=");
    const clave = limpia.slice(0, corte).trim();
    const valor = limpia
      .slice(corte + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (clave && process.env[clave] === undefined) {
      process.env[clave] = valor;
    }
  }
}

function escribir(reporte: unknown) {
  mkdirSync(path.dirname(REPORTE), { recursive: true });
  writeFileSync(REPORTE, `${JSON.stringify(reporte, null, 2)}\n`);
}

function leerPlanilla() {
  const proceso = spawnSync(
    "python3",
    [
      path.join(process.cwd(), "scripts/leer-planilla-colaboradores.py"),
      PLANILLA,
    ],
    { encoding: "utf8" }
  );
  if (proceso.status !== 0) {
    throw new Error(proceso.stderr.trim() || "No se pudo leer la planilla");
  }
  return JSON.parse(proceso.stdout) as Parameters<
    typeof planificarColaboradores
  >[0];
}

function lineasIniciales(
  filas: Parameters<typeof planificarColaboradores>[0],
  plan: ReturnType<typeof planificarColaboradores>
) {
  const lineas = new Map<string, Linea>();
  for (const fila of filas) {
    lineas.set(`${fila.hoja}:${fila.fila}`, {
      consolidado: false,
      fila: fila.fila,
      hoja: fila.hoja,
      pendiente: false,
      resultado: "sin clasificar",
      valido: false,
    });
  }
  for (const pendiente of plan.pendientes) {
    const linea = lineas.get(`${pendiente.hoja}:${pendiente.fila}`);
    if (!linea) {
      continue;
    }
    linea.pendiente = true;
    linea.resultado = pendiente.motivo;
  }
  for (const valido of plan.validos) {
    valido.origenes.forEach((origen, indice) => {
      const linea = lineas.get(`${origen.hoja}:${origen.fila}`);
      if (!linea) {
        return;
      }
      if (indice === 0) {
        linea.valido = true;
        linea.resultado = "listo para asignar";
        return;
      }
      linea.consolidado = true;
      linea.resultado = valido.cargoDescartado
        ? `consolidado; cargo conservado «${valido.cargo}», descartado «${valido.cargoDescartado}»`
        : "consolidado en la entrevista de la misma persona";
    });
  }
  return lineas;
}

async function enLotes<T>(
  items: T[],
  tamano: number,
  fn: (item: T) => Promise<void>
) {
  if (items.length === 0) {
    return;
  }
  await Promise.all(items.slice(0, tamano).map(fn));
  await enLotes(items.slice(tamano), tamano, fn);
}

async function main() {
  cargarEntorno();
  const filas = leerPlanilla();
  const plan = planificarColaboradores(filas);
  const lineas = lineasIniciales(filas, plan);
  const admin = createAdminClient();
  if (!admin) {
    const bloqueo =
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. No se cargó nada y no se afirma que la fase exista.";
    escribir({ bloqueo, filas: [...lineas.values()], plan: resumir(plan) });
    process.stdout.write(`${bloqueo}\n`);
    return;
  }

  const { data: proyectos, error } = await admin
    .from("proyecto")
    .select("id, nombre, cliente");
  if (error || !proyectos) {
    const bloqueo = `No se pudo leer los proyectos: ${error?.message ?? "sin respuesta"}. No se afirma que la fase exista.`;
    escribir({ bloqueo, filas: [...lineas.values()], plan: resumir(plan) });
    process.stdout.write(`${bloqueo}\n`);
    return;
  }
  const candidatos = proyectos.filter((candidato) =>
    esProyectoComplianceLatam(candidato)
  );
  if (candidatos.length !== 1) {
    const bloqueo =
      candidatos.length === 0
        ? "No hay un proyecto ComplianceLatam. No se creó la fase."
        : `Hay ${candidatos.length} proyectos ComplianceLatam: ${candidatos
            .map((candidato) => `${candidato.nombre} (${candidato.id})`)
            .join(", ")}. No se cargó nada.`;
    escribir({ bloqueo, filas: [...lineas.values()], plan: resumir(plan) });
    process.stdout.write(`${bloqueo}\n`);
    return;
  }
  const proyecto = candidatos.at(0);
  if (!proyecto) {
    return;
  }

  const faseId = await asegurarFase(admin, proyecto.id);
  const plantillaId = await asegurarPlantilla(admin, proyecto.id, faseId);
  await enLotes(plan.validos, 8, async (persona) => {
    try {
      const resultado = await asignar(admin, {
        faseId,
        persona,
        plantillaId,
        proyectoId: proyecto.id,
      });
      for (const origen of persona.origenes) {
        const linea = lineas.get(`${origen.hoja}:${origen.fila}`);
        if (linea?.valido) {
          linea.resultado = resultado;
        }
      }
    } catch (causa) {
      const mensaje = causa instanceof Error ? causa.message : "error";
      for (const origen of persona.origenes) {
        const linea = lineas.get(`${origen.hoja}:${origen.fila}`);
        if (linea?.valido) {
          linea.resultado = mensaje;
        }
      }
    }
  });

  await admin.from("carga_incidencia").delete().eq("fase_id", faseId);
  const incidencias = [
    ...plan.pendientes.map((pendiente) => ({
      detalle: pendiente.detalle,
      fase_id: faseId,
      fila: pendiente.fila,
      hoja: pendiente.hoja,
      motivo: pendiente.motivo,
    })),
    ...plan.validos.flatMap((persona) =>
      persona.origenes.slice(1).map((origen) => ({
        detalle: persona.cargoDescartado
          ? `Misma persona. Cargo conservado: ${persona.cargo}. Cargo descartado: ${persona.cargoDescartado}.`
          : "Misma persona, filas consolidadas en una entrevista.",
        fase_id: faseId,
        fila: origen.fila,
        hoja: origen.hoja,
        motivo: "consolidado",
      }))
    ),
  ];
  if (incidencias.length > 0) {
    const { error: errorIncidencia } = await admin
      .from("carga_incidencia")
      .insert(incidencias);
    if (errorIncidencia) {
      throw errorIncidencia;
    }
  }

  const reporte = {
    bloqueo: null,
    faseId,
    filas: [...lineas.values()],
    plan: resumir(plan),
    proyectoId: proyecto.id,
  };
  escribir(reporte);
  process.stdout.write(
    `Proyecto ${proyecto.nombre}. Fase ${faseId}. Válidas ${plan.validos.length}. Pendientes ${plan.pendientes.length}. Reporte en ${REPORTE}\n`
  );
}

function resumir(plan: ReturnType<typeof planificarColaboradores>) {
  return {
    absorbidas: plan.validos.reduce(
      (total, persona) => total + Math.max(0, persona.origenes.length - 1),
      0
    ),
    pendientes: plan.pendientes.length,
    validos: plan.validos.length,
  };
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function asegurarFase(admin: Admin, proyectoId: string) {
  const { data: existentes, error } = await admin
    .from("fase")
    .select("id, orden")
    .eq("proyecto_id", proyectoId)
    .eq("nombre", NOMBRE_FASE_COLABORADORES);
  if (error) {
    throw error;
  }
  if ((existentes ?? []).length > 1) {
    throw new Error("La fase de colaboradores está repetida en el proyecto.");
  }
  let faseId = existentes?.[0]?.id ?? null;
  if (!faseId) {
    const { data: ultima } = await admin
      .from("fase")
      .select("orden")
      .eq("proyecto_id", proyectoId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: creada, error: errorFase } = await admin
      .from("fase")
      .insert({
        estado: "en_progreso",
        minutos: MINUTOS_CL_COLABORADORES,
        nombre: NOMBRE_FASE_COLABORADORES,
        orden: (ultima?.orden ?? 0) + 1,
        proyecto_id: proyectoId,
      })
      .select("id")
      .single();
    if (errorFase || !creada) {
      throw errorFase ?? new Error("No se pudo crear la fase");
    }
    faseId = creada.id;
  }
  const { error: errorTextos } = await admin
    .from("fase")
    .update({
      invitacion_asunto: ASUNTO_INVITACION_COLABORADORES,
      invitacion_cuerpo: CUERPO_INVITACION_COLABORADORES,
      minutos: MINUTOS_CL_COLABORADORES,
    })
    .eq("id", faseId);
  if (errorTextos) {
    throw errorTextos;
  }
  return faseId;
}

async function asegurarPlantilla(
  admin: Admin,
  proyectoId: string,
  faseId: string
) {
  const { data: existente } = await admin
    .from("entrevista_plantilla")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .eq("fase_id", faseId)
    .eq("nombre", NOMBRE_PLANTILLA_CL_COLABORADORES)
    .maybeSingle();
  if (existente?.id) {
    return existente.id;
  }
  const secciones = seccionesDeGuionClColaboradores();
  const { data, error } = await admin
    .from("entrevista_plantilla")
    .insert({
      fase_id: faseId,
      instrucciones_agente: INSTRUCCIONES_AGENTE_CL_COLABORADORES,
      nombre: NOMBRE_PLANTILLA_CL_COLABORADORES,
      preguntas: preguntasDeSecciones(secciones),
      proyecto_id: proyectoId,
      secciones,
      trato: TRATO_CL_COLABORADORES,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("No se pudo crear la plantilla");
  }
  return data.id;
}

async function asignar(
  admin: Admin,
  {
    faseId,
    persona,
    plantillaId,
    proyectoId,
  }: {
    faseId: string;
    persona: ReturnType<typeof planificarColaboradores>["validos"][number];
    plantillaId: string;
    proyectoId: string;
  }
) {
  const { data: personas } = await admin
    .from("stakeholder")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .ilike("email", persona.correo);
  if ((personas ?? []).length > 1) {
    throw new Error(`Hay más de un stakeholder para ${persona.correo}`);
  }
  let stakeholderId = personas?.[0]?.id ?? null;
  if (!stakeholderId) {
    const { data: creado, error } = await admin
      .from("stakeholder")
      .insert({
        apellido: persona.apellido,
        cargo: persona.cargo,
        email: persona.correo,
        firma: persona.empresa,
        industria: persona.industria,
        nombre: persona.nombre,
        pais: persona.pais,
        proyecto_id: proyectoId,
      })
      .select("id")
      .single();
    if (error || !creado) {
      throw error ?? new Error("No se pudo crear la persona");
    }
    stakeholderId = creado.id;
  }

  const { data: entrevista } = await admin
    .from("entrevista")
    .select("id")
    .eq("stakeholder_id", stakeholderId)
    .eq("plantilla_id", plantillaId)
    .maybeSingle();
  let entrevistaId = entrevista?.id ?? null;
  if (!entrevistaId) {
    const secciones = seccionesDeGuionClColaboradores();
    const { data: creada, error } = await admin
      .from("entrevista")
      .insert({
        estado: "abierta",
        instrucciones_agente: INSTRUCCIONES_AGENTE_CL_COLABORADORES,
        plantilla_id: plantillaId,
        preguntas: preguntasDeSecciones(secciones),
        secciones,
        stakeholder_id: stakeholderId,
        trato: TRATO_CL_COLABORADORES,
      })
      .select("id")
      .single();
    if (error || !creada) {
      throw error ?? new Error("No se pudo crear la entrevista");
    }
    entrevistaId = creada.id;
  }

  const { data: tarea } = await admin
    .from("tarea")
    .select("id")
    .eq("fase_id", faseId)
    .eq("entrevista_id", entrevistaId)
    .eq("tipo", "entrevista")
    .maybeSingle();
  if (!tarea) {
    const { error } = await admin.from("tarea").insert({
      entrevista_id: entrevistaId,
      fase_id: faseId,
      responsable: persona.nombre,
      tipo: "entrevista",
    });
    if (error) {
      throw error;
    }
  }

  await asegurarEnlace(admin, entrevistaId);
  return entrevista ? "ya existía" : "asignada";
}

async function asegurarEnlace(admin: Admin, entrevistaId: string) {
  const secreto = process.env.AUTH_SECRET ?? "";
  if (!secreto) {
    throw new Error("Falta AUTH_SECRET para guardar el enlace");
  }
  const { data: existente } = await admin
    .from("entrevista_enlace")
    .select("revocado_en")
    .eq("entrevista_id", entrevistaId)
    .maybeSingle();
  if (existente && !existente.revocado_en) {
    return;
  }
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("entrevista_enlace").upsert(
    {
      entrevista_id: entrevistaId,
      revocado_en: null,
      token_cifrado: cifrarSecreto(token, secreto),
      token_hash: createHash("sha256").update(token).digest("hex"),
    },
    { onConflict: "entrevista_id" }
  );
  if (error) {
    throw error;
  }
}

main().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : "Error de carga";
  escribir({ bloqueo: mensaje });
  process.stderr.write(`${mensaje}\n`);
  process.exitCode = 1;
});
