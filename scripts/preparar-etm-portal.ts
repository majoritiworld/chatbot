/**
 * Creates the ETM Tuesday project and assignments on the portal database the
 * process points at. Idempotent: an existing person in the project is kept as
 * is. Never reads or writes another project, and sends no mail.
 *
 *   MODO=pruebas      Gabriel, Amelia and Juan Pablo. Prepared, mail held.
 *   MODO=seba         Seba's own run, mentor segment. Its own new assignment.
 *   MODO=verificacion Fictitious people (RONDA=<n>) with a personal link, to
 *                     check the journey without using the real assignments.
 *                     SOLO_VERIFICACION=mentor keeps one of them.
 *   MODO=v2           New local demo interviews for the brief-plus-deepening
 *                     guide. Never updates an existing interview. Local only.
 *
 * Dry run unless APLICAR=1. On a non-local database it also needs
 * CONFIRMAR_PROYECTO=etm-tuesday. LOGO_ETM=<png> uploads the brand logo.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/preparar-etm-portal.ts
 */
import { readFileSync } from "node:fs";
import { asegurarEnlaceEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { siteUrl } from "@/lib/consultoria/auth";
import { preguntasDeSecciones } from "@/lib/consultoria/entrevista-contenido";
import {
  ASUNTO_AGRADECIMIENTO_ETM,
  ASUNTO_INVITACION_ETM,
  type AudienciaEtm,
  AVISO_RESPUESTAS_ETM,
  asuntoInvitacionEtm,
  bienvenidaEtm,
  CLIENTE_ETM,
  CONTACTO_EMAIL_ETM,
  CONTACTO_NOMBRE_ETM,
  CUERPO_AGRADECIMIENTO_ETM,
  cuerpoInvitacionEtm,
  faseDeAudiencia,
  INSTRUCCIONES_AGENTE_ETM,
  NOMBRE_PUBLICO_ETM,
  SLUG_ETM_TUESDAY,
  seccionesDeGuionEtm,
  TEXTO_BIENVENIDA_ETM,
  TITULO_INICIATIVA_ETM,
  TRATO_ETM,
} from "@/lib/consultoria/guiones/etm-tuesday";
import { esParticipantePruebaEtm } from "@/lib/consultoria/invitacion-etm";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type Persona = {
  apellido: string;
  audiencia: AudienciaEtm;
  descripcion?: string;
  email: string;
  firma?: string;
  genero?: "femenino" | "masculino";
  nombre: string;
};

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost"]);
const NOMBRE_PROYECTO = "ETM Tuesday";
const BUCKET_LOGO = "marcas";
const PREFIJO_PRUEBA = "PRUEBA · recorrido — ";

/** Assignment and segment authorized on 1 Oct 2026. */
const PRUEBAS: Persona[] = [
  {
    apellido: "Fuentes",
    audiencia: "sponsors",
    email: "gabriel.fuentes@emprendetumente.org",
    nombre: "Gabriel",
  },
  {
    apellido: "Somavia",
    audiencia: "mentoreados",
    email: "amelia.somavia@emprendetumente.org",
    nombre: "Amelia",
  },
  {
    apellido: "Lobos",
    audiencia: "mentores",
    email: "juan.lobos@emprendetumente.org",
    nombre: "Juan Pablo",
  },
];

/** Seba's run before the ETM sends, chosen segment: mentores. */
const SEBA: Persona[] = [
  {
    apellido: "Majoriti",
    audiencia: "mentores",
    email: "seba@majoriti.world",
    nombre: "Seba",
  },
];

function verificacion(ronda: string): Persona[] {
  return [
    {
      apellido: "Ríos",
      audiencia: "sponsors",
      email: `verificacion.sponsor.r${ronda}@example.test`,
      nombre: "Teresa",
    },
    {
      apellido: "Paz",
      audiencia: "mentoreados",
      email: `verificacion.mentoreada.r${ronda}@example.test`,
      nombre: "Valentina",
    },
    {
      apellido: "Mora",
      audiencia: "mentores",
      email: `verificacion.mentor.r${ronda}@example.test`,
      nombre: "Rodrigo",
    },
    {
      apellido: "Silva",
      audiencia: "mentores",
      email: `verificacion.mentor-movil.r${ronda}@example.test`,
      nombre: "Carla",
    },
  ];
}

const DEMO_V2: Persona[] = [
  {
    apellido: "Salas",
    audiencia: "mentores",
    email: "bruno.salas.v2@example.test",
    nombre: "Bruno",
  },
  {
    apellido: "Arancibia",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "sofia.arancibia.v2@example.test",
    firma: "Taller Sur",
    nombre: "Sofía",
  },
  {
    apellido: "Cruz",
    audiencia: "sponsors",
    email: "elena.cruz.v2@example.test",
    nombre: "Elena",
  },
  {
    apellido: "Lagos",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "amanda.lagos.v2@example.test",
    firma: "Taller Sur",
    nombre: "Amanda",
  },
  {
    apellido: "Peña",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "laura.pena.v2@example.test",
    firma: "Taller Sur",
    nombre: "Laura",
  },
  {
    apellido: "Soto",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "camila.soto.v2@example.test",
    firma: "Taller Sur",
    nombre: "Camila",
  },
  {
    apellido: "Ríos",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "martina.rios.v2@example.test",
    firma: "Taller Sur",
    nombre: "Martina",
  },
  {
    apellido: "Vidal",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "renata.vidal.v2@example.test",
    firma: "Taller Sur",
    nombre: "Renata",
  },
  {
    apellido: "Mora",
    audiencia: "mentoreados",
    descripcion:
      "Emprendimiento de cerámica. Están evaluando quitar la transcripción de notas de su producto.",
    email: "isabel.mora.v2@example.test",
    firma: "Taller Sur",
    nombre: "Isabel",
  },
  {
    apellido: "Rojas",
    audiencia: "mentores",
    email: "catalina.rojas.v2@example.test",
    genero: "femenino",
    nombre: "Catalina",
  },
  {
    apellido: "Silva",
    audiencia: "mentores",
    email: "antonia.silva.v2@example.test",
    genero: "femenino",
    nombre: "Antonia",
  },
  {
    apellido: "Fuentes",
    audiencia: "mentores",
    email: "fernanda.fuentes.v2@example.test",
    genero: "femenino",
    nombre: "Fernanda",
  },
  {
    apellido: "Riquelme",
    audiencia: "sponsors",
    email: "paula.riquelme.v2@example.test",
    nombre: "Paula",
  },
  {
    apellido: "Godoy",
    audiencia: "sponsors",
    email: "valeria.godoy.v2@example.test",
    nombre: "Valeria",
  },
  {
    apellido: "Paredes",
    audiencia: "sponsors",
    email: "andres.paredes.v2@example.test",
    nombre: "Andrés",
  },
  {
    apellido: "Reyes",
    audiencia: "sponsors",
    email: "joaquin.reyes.v2@example.test",
    nombre: "Joaquín",
  },
  {
    apellido: "Herrera",
    audiencia: "sponsors",
    email: "tomas.herrera.v2@example.test",
    nombre: "Tomás",
  },
  {
    apellido: "Núñez",
    audiencia: "sponsors",
    email: "josefa.nunez.v2@example.test",
    nombre: "Josefa",
  },
  {
    apellido: "Contreras",
    audiencia: "sponsors",
    email: "ines.contreras.v2@example.test",
    nombre: "Inés",
  },
  {
    apellido: "Vidal",
    audiencia: "sponsors",
    email: "clara.vidal.v2@example.test",
    nombre: "Clara",
  },
  {
    apellido: "Salas",
    audiencia: "sponsors",
    email: "diego.salas.v2@example.test",
    nombre: "Diego",
  },
  {
    apellido: "Soto",
    audiencia: "sponsors",
    email: "marina.soto.v2@example.test",
    nombre: "Marina",
  },
  {
    apellido: "Bravo",
    audiencia: "mentores",
    email: "mateo.bravo.v2@example.test",
    genero: "masculino",
    nombre: "Mateo",
  },
  {
    apellido: "Castro",
    audiencia: "mentoreados",
    descripcion: "Emprendimiento de logística para ferias.",
    email: "lucia.castro.v2@example.test",
    firma: "Kalos",
    nombre: "Lucía",
  },
];

function personasDe(
  modo: "pruebas" | "seba" | "verificacion" | "v2",
  ronda: string
) {
  if (modo === "v2") {
    return DEMO_V2;
  }
  if (modo === "pruebas") {
    return PRUEBAS;
  }
  if (modo === "seba") {
    return SEBA;
  }
  const solo = process.env.SOLO_VERIFICACION?.trim();
  const personas = verificacion(ronda);
  return solo
    ? personas.filter((p) => p.email.startsWith(`verificacion.${solo}.`))
    : personas;
}

function escribir(linea: string) {
  process.stdout.write(`${linea}\n`);
}

function entorno() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch (error) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL", { cause: error });
  }
  const local = HOSTS_LOCALES.has(host);
  const slug = process.env.SLUG_ETM?.trim() || SLUG_ETM_TUESDAY;
  if (!local && slug !== SLUG_ETM_TUESDAY) {
    throw new Error("Fuera de local el slug es siempre etm-tuesday.");
  }
  if (!local && process.env.CONFIRMAR_PROYECTO !== SLUG_ETM_TUESDAY) {
    throw new Error(
      `Base remota (${host}). Falta CONFIRMAR_PROYECTO=${SLUG_ETM_TUESDAY}.`
    );
  }
  const modo = process.env.MODO;
  if (
    modo !== "pruebas" &&
    modo !== "seba" &&
    modo !== "verificacion" &&
    modo !== "v2"
  ) {
    throw new Error("MODO debe ser pruebas, seba, verificacion o v2");
  }
  if (modo === "v2" && !local) {
    throw new Error("La demo v2 solo se crea en una base local.");
  }
  const ronda = process.env.RONDA?.trim() ?? "";
  if (modo === "verificacion" && !/^\d{1,3}$/.test(ronda)) {
    throw new Error("MODO=verificacion necesita RONDA=<n>");
  }
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    admin,
    aplicar: process.env.APLICAR === "1",
    host,
    modo,
    personas: personasDe(modo, ronda),
    slug,
  };
}

async function huellaAjena(admin: Admin, proyectoId: string | null) {
  const { data, error } = await admin
    .from("stakeholder")
    .select("id, proyecto_id")
    .neq("proyecto_id", proyectoId ?? "00000000-0000-0000-0000-000000000000");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).length;
}

async function unico<T extends { id: string }>(
  consulta: PromiseLike<{ data: T | null; error: { message: string } | null }>
) {
  const { data, error } = await consulta;
  if (error || !data) {
    throw new Error(error?.message ?? "Fila no creada");
  }
  return data;
}

async function asegurarProyecto(admin: Admin, slug: string, aplicar: boolean) {
  const { data, error } = await admin
    .from("proyecto")
    .select("id, nombre, cliente")
    .eq("slug", slug);
  if (error) {
    throw new Error(error.message);
  }
  const existente = data?.at(0);
  if (existente) {
    if (
      existente.nombre !== NOMBRE_PROYECTO ||
      existente.cliente !== CLIENTE_ETM
    ) {
      throw new Error(
        `El slug ${slug} es de «${existente.nombre}». No lo toco.`
      );
    }
    return { creado: false, id: existente.id as string };
  }
  if (!aplicar) {
    return { creado: true, id: null };
  }
  const creado = await unico(
    admin
      .from("proyecto")
      .insert({
        aviso_respuestas: AVISO_RESPUESTAS_ETM,
        cliente: CLIENTE_ETM,
        contacto_email: CONTACTO_EMAIL_ETM,
        contacto_nombre: CONTACTO_NOMBRE_ETM,
        correo_asunto: ASUNTO_AGRADECIMIENTO_ETM,
        correo_cuerpo: CUERPO_AGRADECIMIENTO_ETM,
        correo_firma: CONTACTO_NOMBRE_ETM,
        correo_remitente: NOMBRE_PUBLICO_ETM,
        descripcion:
          "Entrevistas de ETM Tuesday. Las asignaciones con plantilla «PRUEBA · recorrido» y las de @example.test son pruebas: no forman parte del piloto ni van a Notion.",
        invitacion_asunto: ASUNTO_INVITACION_ETM,
        nombre: NOMBRE_PROYECTO,
        nombre_publico: NOMBRE_PUBLICO_ETM,
        slug,
        texto_bienvenida: TEXTO_BIENVENIDA_ETM,
        titulo_iniciativa: TITULO_INICIATIVA_ETM,
      })
      .select("id")
      .single()
  );
  return { creado: true, id: creado.id };
}

async function asegurarFase(
  admin: Admin,
  proyectoId: string,
  audiencia: AudienciaEtm
) {
  const meta = faseDeAudiencia(audiencia);
  const { data, error } = await admin
    .from("fase")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .eq("nombre", meta.nombre);
  if (error) {
    throw new Error(error.message);
  }
  const existente = data?.at(0);
  if (existente) {
    return existente.id as string;
  }
  const fase = await unico(
    admin
      .from("fase")
      .insert({
        acceso_enlace_personal: true,
        bloque_comercial: null,
        estado: "en_progreso",
        invitacion_asunto: asuntoInvitacionEtm(audiencia),
        invitacion_cuerpo: cuerpoInvitacionEtm(audiencia),
        minutos: null,
        nombre: meta.nombre,
        orden: meta.orden,
        proyecto_id: proyectoId,
        texto_bienvenida: bienvenidaEtm(audiencia),
      })
      .select("id")
      .single()
  );
  return fase.id;
}

async function asegurarPlantilla(
  admin: Admin,
  proyectoId: string,
  faseId: string,
  audiencia: AudienciaEtm
) {
  const nombre = `${PREFIJO_PRUEBA}${faseDeAudiencia(audiencia).plantilla}`;
  const { data, error } = await admin
    .from("entrevista_plantilla")
    .select("id")
    .eq("fase_id", faseId)
    .eq("nombre", nombre);
  if (error) {
    throw new Error(error.message);
  }
  const existente = data?.at(0);
  if (existente) {
    return existente.id as string;
  }
  const secciones = seccionesDeGuionEtm(audiencia);
  const plantilla = await unico(
    admin
      .from("entrevista_plantilla")
      .insert({
        fase_id: faseId,
        instrucciones_agente: INSTRUCCIONES_AGENTE_ETM,
        nombre,
        preguntas: preguntasDeSecciones(secciones),
        proyecto_id: proyectoId,
        secciones,
        trato: TRATO_ETM,
      })
      .select("id")
      .single()
  );
  return plantilla.id;
}

async function crearAsignacion(
  admin: Admin,
  datos: {
    faseId: string;
    persona: Persona;
    plantillaId: string;
    proyectoId: string;
  }
) {
  const { persona } = datos;
  const secciones = seccionesDeGuionEtm(persona.audiencia, persona.genero);
  const stakeholder = await unico(
    admin
      .from("stakeholder")
      .insert({
        apellido: persona.apellido,
        ...(persona.descripcion ? { descripcion: persona.descripcion } : {}),
        email: persona.email,
        ...(persona.firma ? { firma: persona.firma } : {}),
        nombre: persona.nombre,
        proyecto_id: datos.proyectoId,
      })
      .select("id")
      .single()
  );
  const entrevista = await unico(
    admin
      .from("entrevista")
      .insert({
        estado: "abierta",
        instrucciones_agente: INSTRUCCIONES_AGENTE_ETM,
        plantilla_id: datos.plantillaId,
        preguntas: preguntasDeSecciones(secciones),
        secciones,
        stakeholder_id: stakeholder.id,
        trato: TRATO_ETM,
      })
      .select("id")
      .single()
  );
  const { error } = await admin.from("tarea").insert({
    entrevista_id: entrevista.id,
    fase_id: datos.faseId,
    responsable: `${persona.nombre} ${persona.apellido}`,
    tipo: "entrevista",
  });
  if (error) {
    throw new Error(error.message);
  }
  return entrevista.id;
}

async function asignacionExistente(
  admin: Admin,
  proyectoId: string,
  email: string
) {
  const { data, error } = await admin
    .from("stakeholder")
    .select("id, entrevista(id, estado)")
    .eq("proyecto_id", proyectoId)
    .ilike("email", email);
  if (error) {
    throw new Error(error.message);
  }
  return data?.at(0) ?? null;
}

async function subirLogo(admin: Admin, proyectoId: string, slug: string) {
  const ruta = process.env.LOGO_ETM?.trim();
  if (!ruta) {
    return null;
  }
  const destino = `${slug}/logo.png`;
  const { error } = await admin.storage
    .from(BUCKET_LOGO)
    .upload(destino, readFileSync(ruta), {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    throw new Error(`Logo: ${error.message}`);
  }
  const { error: marca } = await admin
    .from("proyecto")
    .update({ logo_path: destino })
    .eq("id", proyectoId);
  if (marca) {
    throw new Error(marca.message);
  }
  return destino;
}

async function main() {
  const { admin, aplicar, host, modo, personas, slug } = entorno();
  if (
    modo === "verificacion" &&
    personas.some((p) => esParticipantePruebaEtm(p.email))
  ) {
    throw new Error("La verificación no usa a las tres personas reales.");
  }
  escribir(`supabase=${host} slug=${slug} modo=${modo} aplicar=${aplicar}`);
  const proyecto = await asegurarProyecto(admin, slug, aplicar);
  escribir(`proyecto=${proyecto.id ?? "(nuevo)"} creado=${proyecto.creado}`);
  if (!(aplicar && proyecto.id)) {
    for (const persona of personas) {
      escribir(
        `crearía ${persona.audiencia} ${persona.nombre} ${persona.apellido}`
      );
    }
    return;
  }
  const proyectoId = proyecto.id;
  const ajenaAntes = await huellaAjena(admin, proyectoId);
  const logo = await subirLogo(admin, proyectoId, slug);
  if (logo) {
    escribir(`logo=${logo}`);
  }
  for (const persona of personas) {
    // biome-ignore lint/performance/noAwaitInLoops: a few rows, fixed order
    const previa = await asignacionExistente(admin, proyectoId, persona.email);
    if (previa) {
      let enlace = "";
      if (modo === "v2" || modo === "verificacion") {
        let entrevistas: Array<{ id?: string }> = [];
        if (Array.isArray(previa.entrevista)) {
          entrevistas = previa.entrevista;
        } else if (previa.entrevista) {
          entrevistas = [previa.entrevista];
        }
        const entrevistaId = entrevistas.at(0)?.id;
        if (typeof entrevistaId === "string") {
          const token = await asegurarEnlaceEntrevista(entrevistaId);
          enlace = token
            ? ` enlace=${siteUrl()}/e/${token}`
            : " enlace=(sin secreto)";
        }
      }
      escribir(
        `ya existe ${persona.audiencia} ${persona.nombre} stakeholder=${previa.id}${enlace}`
      );
      continue;
    }
    const faseId = await asegurarFase(admin, proyectoId, persona.audiencia);
    const plantillaId = await asegurarPlantilla(
      admin,
      proyectoId,
      faseId,
      persona.audiencia
    );
    const entrevistaId = await crearAsignacion(admin, {
      faseId,
      persona,
      plantillaId,
      proyectoId,
    });
    let enlace = "";
    if (modo === "verificacion" || modo === "v2") {
      const token = await asegurarEnlaceEntrevista(entrevistaId);
      enlace = token
        ? ` enlace=${siteUrl()}/e/${token}`
        : " enlace=(sin secreto)";
    }
    escribir(
      `${persona.audiencia} ${persona.nombre} ${persona.apellido} entrevista=${entrevistaId}${enlace}`
    );
  }
  const ajenaDespues = await huellaAjena(admin, proyectoId);
  if (ajenaAntes !== ajenaDespues) {
    throw new Error("Cambió otro proyecto. Revisa antes de seguir.");
  }
  escribir(`otros_proyectos_sin_cambios=${ajenaDespues}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Error de preparación"}\n`
  );
  process.exitCode = 1;
});
