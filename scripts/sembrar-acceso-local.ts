/**
 * Fictitious participants to exercise interview access on the LOCAL stack.
 * Refuses any Supabase URL that is not 127.0.0.1 or localhost, sends no mail.
 *
 *   supabase db reset --local
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service key> AUTH_SECRET=<same as dev> \
 *   npx tsx scripts/sembrar-acceso-local.ts
 */
import { createHash } from "node:crypto";
import { preguntasDeSecciones } from "@/lib/consultoria/entrevista-contenido";
import {
  INSTRUCCIONES_AGENTE_CL_COLABORADORES,
  NOMBRE_FASE_COLABORADORES,
  seccionesDeGuionClColaboradores,
  TRATO_CL_COLABORADORES,
} from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import { cifrarSecreto } from "@/lib/consultoria/token-cifrado";
import { createAdminClient } from "@/lib/supabase/admin";

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost"]);
const FASE_SOCIAS = "Entrevistas a Firmas Socias";
const CLAVE_ADMIN = "prueba-local-admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type Persona = {
  email: string;
  nombre: string;
  apellido: string;
  fases: ("socias" | "colaboradores")[];
  enlace?: string;
};

const PERSONAS: Persona[] = [
  {
    apellido: "Socia",
    email: "socia@prueba.test",
    fases: ["socias"],
    nombre: "Sara",
  },
  {
    apellido: "Colaborador",
    email: "colab@prueba.test",
    enlace: "prueba-enlace-colab-0001",
    fases: ["colaboradores"],
    nombre: "Carlos",
  },
  {
    apellido: "Colaboradora",
    email: "otra.colab@prueba.test",
    enlace: "prueba-enlace-otra-0002",
    fases: ["colaboradores"],
    nombre: "Olga",
  },
  {
    apellido: "Doble",
    email: "ambas@prueba.test",
    enlace: "prueba-enlace-ambas-0003",
    fases: ["socias", "colaboradores"],
    nombre: "Ana",
  },
  {
    apellido: "Admin",
    email: "admin@prueba.test",
    fases: ["socias"],
    nombre: "Alba",
  },
];

function asegurarLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!HOSTS_LOCALES.has(new URL(url).hostname)) {
    throw new Error(`Solo se siembra en Supabase local, no en ${url}`);
  }
  const secreto = process.env.AUTH_SECRET ?? "";
  if (!secreto) {
    throw new Error("Falta AUTH_SECRET (el mismo que usa el servidor local)");
  }
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY local");
  }
  return { admin, secreto };
}

async function unico(
  consulta: PromiseLike<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>
) {
  const { data, error } = await consulta;
  if (error || !data) {
    throw new Error(error?.message ?? "Fila no creada");
  }
  return data;
}

async function crearProyecto(
  admin: Admin,
  datos: { slug: string; nombre: string; cliente: string }
) {
  await admin.from("proyecto").delete().eq("slug", datos.slug);
  return await unico(
    admin
      .from("proyecto")
      .insert({
        ...datos,
        contacto_email: "contacto@prueba.test",
        contacto_nombre: "Contacto de prueba",
        nombre_publico: datos.cliente,
      })
      .select("id")
      .single()
  );
}

async function crearFase(
  admin: Admin,
  proyectoId: string,
  datos: {
    nombre: string;
    orden: number;
    acceso_solo_correo?: boolean;
    acceso_enlace_personal?: boolean;
  }
) {
  const fase = await unico(
    admin
      .from("fase")
      .insert({ ...datos, estado: "en_progreso", proyecto_id: proyectoId })
      .select("id")
      .single()
  );
  const secciones = seccionesDeGuionClColaboradores();
  const plantilla = await unico(
    admin
      .from("entrevista_plantilla")
      .insert({
        fase_id: fase.id,
        instrucciones_agente: INSTRUCCIONES_AGENTE_CL_COLABORADORES,
        nombre: `Pauta ${datos.nombre}`,
        preguntas: preguntasDeSecciones(secciones),
        proyecto_id: proyectoId,
        secciones,
        trato: TRATO_CL_COLABORADORES,
      })
      .select("id")
      .single()
  );
  return { faseId: fase.id, plantillaId: plantilla.id };
}

async function asignar(
  admin: Admin,
  datos: {
    faseId: string;
    plantillaId: string;
    stakeholderId: string;
    responsable: string;
  }
) {
  const secciones = seccionesDeGuionClColaboradores();
  const entrevista = await unico(
    admin
      .from("entrevista")
      .insert({
        estado: "abierta",
        instrucciones_agente: INSTRUCCIONES_AGENTE_CL_COLABORADORES,
        plantilla_id: datos.plantillaId,
        preguntas: preguntasDeSecciones(secciones),
        secciones,
        stakeholder_id: datos.stakeholderId,
        trato: TRATO_CL_COLABORADORES,
      })
      .select("id")
      .single()
  );
  const { error } = await admin.from("tarea").insert({
    entrevista_id: entrevista.id,
    fase_id: datos.faseId,
    responsable: datos.responsable,
    tipo: "entrevista",
  });
  if (error) {
    throw new Error(error.message);
  }
  return entrevista.id;
}

async function guardarEnlace(
  admin: Admin,
  entrevistaId: string,
  token: string,
  secreto: string
) {
  const { error } = await admin.from("entrevista_enlace").insert({
    entrevista_id: entrevistaId,
    token_cifrado: cifrarSecreto(token, secreto),
    token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function crearAdminMajoriti(admin: Admin, email: string) {
  const { data: lista } = await admin.auth.admin.listUsers();
  const previo = lista.users.find((u) => u.email === email);
  if (previo) {
    await admin.auth.admin.deleteUser(previo.id);
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: CLAVE_ADMIN,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "No se creó el admin");
  }
  const { error: errorPerfil } = await admin
    .from("usuario")
    .upsert({ email, id: data.user.id, nombre: "Alba Admin", rol: "majoriti" });
  if (errorPerfil) {
    throw new Error(errorPerfil.message);
  }
}

async function sembrarPersona(
  admin: Admin,
  secreto: string,
  contexto: {
    proyectoId: string;
    fases: Record<
      Persona["fases"][number],
      { faseId: string; plantillaId: string }
    >;
  },
  persona: Persona
) {
  const stakeholder = await unico(
    admin
      .from("stakeholder")
      .insert({
        apellido: persona.apellido,
        email: persona.email,
        nombre: persona.nombre,
        proyecto_id: contexto.proyectoId,
      })
      .select("id")
      .single()
  );
  const filas: string[] = [];
  for (const clave of persona.fases) {
    // biome-ignore lint/performance/noAwaitInLoops: one person, at most two phases
    const entrevistaId = await asignar(admin, {
      ...contexto.fases[clave],
      responsable: persona.nombre,
      stakeholderId: stakeholder.id,
    });
    if (clave === "colaboradores" && persona.enlace) {
      await guardarEnlace(admin, entrevistaId, persona.enlace, secreto);
      filas.push(`${clave}=${entrevistaId} enlace=/e/${persona.enlace}`);
    } else {
      filas.push(`${clave}=${entrevistaId}`);
    }
  }
  return `${persona.email}: ${filas.join(" ")}`;
}

async function main() {
  const { admin, secreto } = asegurarLocal();
  const proyecto = await crearProyecto(admin, {
    cliente: "ComplianceLatam",
    nombre: "ComplianceLatam (prueba local)",
    slug: "compliance-latam",
  });
  const socias = await crearFase(admin, proyecto.id, {
    acceso_solo_correo: true,
    nombre: FASE_SOCIAS,
    orden: 2,
  });
  const colaboradores = await crearFase(admin, proyecto.id, {
    acceso_enlace_personal: true,
    nombre: NOMBRE_FASE_COLABORADORES,
    orden: 6,
  });
  const contexto = {
    fases: { colaboradores, socias },
    proyectoId: proyecto.id,
  };
  const lineas: string[] = [`proyecto=${proyecto.id}`];
  for (const persona of PERSONAS) {
    // biome-ignore lint/performance/noAwaitInLoops: fixed order keeps output readable
    lineas.push(await sembrarPersona(admin, secreto, contexto, persona));
  }

  const otro = await crearProyecto(admin, {
    cliente: "Otra Firma",
    nombre: "Otra Firma (prueba local)",
    slug: "otra-firma",
  });
  const otraFase = await crearFase(admin, otro.id, {
    nombre: FASE_SOCIAS,
    orden: 1,
  });
  const ajena = await unico(
    admin
      .from("stakeholder")
      .insert({
        email: "socia@prueba.test",
        nombre: "Sara",
        proyecto_id: otro.id,
      })
      .select("id")
      .single()
  );
  const entrevistaAjena = await asignar(admin, {
    ...otraFase,
    responsable: "Sara",
    stakeholderId: ajena.id,
  });
  lineas.push(`otra-firma socia@prueba.test: socias=${entrevistaAjena}`);

  await crearAdminMajoriti(admin, "admin@prueba.test");
  lineas.push(`admin@prueba.test clave=${CLAVE_ADMIN} rol=majoriti`);
  process.stdout.write(`${lineas.join("\n")}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Error de siembra"}\n`
  );
  process.exitCode = 1;
});
