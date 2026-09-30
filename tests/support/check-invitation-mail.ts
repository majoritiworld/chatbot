import assert from "node:assert/strict";
import {
  CorreoBloqueadoError,
  enviarCorreoAgradecimiento,
  enviarCorreoInvitacion,
} from "@/lib/consultoria/email-entrevista";

// Separate process; Supabase and Resend are both replaced. No mail is sent.
process.env.RESEND_API_KEY = "synthetic-key";
process.env.INTERVIEW_EMAIL_FROM = "Majoriti <sender@example.test>";
process.env.INTERVIEW_EMAIL_BCC = "team@example.test";
process.env.BLOQUEAR_CORREO_ENTREVISTA = "0";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role";
process.env.NEXT_PUBLIC_SITE_URL = "https://portal.example.test";
process.env.HABILITAR_INVITACIONES_CORREO = "";

const PROYECTO_A = "10000000-0000-4000-8000-00000000000a";
const PROYECTO_B = "10000000-0000-4000-8000-00000000000b";
const FASE_A = "10000000-0000-4000-8000-0000000000fa";
const FASE_B = "10000000-0000-4000-8000-0000000000fb";

const proyectos: Record<string, Record<string, unknown>> = {
  [PROYECTO_A]: {
    cliente: "Compliance Demo SA",
    color_principal: "#1f4b3a",
    contacto_email: "Ana@Cliente.test",
    contacto_nombre: "Ana",
    correo_asunto: null,
    correo_cuerpo: null,
    correo_firma: null,
    correo_remitente: null,
    id: PROYECTO_A,
    invitacion_asunto: "Invitación de Compliance Demo",
    invitacion_cuerpo: null,
    logo_path: `${PROYECTO_A}/logo.png`,
    nombre_publico: "Compliance Demo",
    slug: "cliente-2026",
    titulo_iniciativa: "Iniciativa 2026",
  },
  [PROYECTO_B]: {
    cliente: "Otra Firma",
    contacto_email: null,
    id: PROYECTO_B,
    nombre_publico: "Otra Firma",
    slug: "otra-firma",
  },
};

const fases: Record<string, Record<string, unknown>> = {
  [FASE_A]: {
    bloque_comercial: null,
    id: FASE_A,
    invitacion_asunto: null,
    invitacion_cuerpo: null,
    minutos: 15,
    proyecto_id: PROYECTO_A,
  },
  [FASE_B]: { id: FASE_B, minutos: 10, proyecto_id: PROYECTO_B },
};

function entrevista(
  id: string,
  proyectoId: string,
  faseId: string,
  email = "participant@example.test"
) {
  const fase = fases[faseId];
  return {
    id,
    plantilla: { fase, proyecto_id: fase?.proyecto_id },
    stakeholder: {
      apellido: "Prueba",
      email,
      nombre: "Lucía",
      proyecto_id: proyectoId,
    },
  };
}

const entrevistas: Record<string, Record<string, unknown>> = {
  "e-mezcla": entrevista("e-mezcla", PROYECTO_A, FASE_B),
  "e-ok": entrevista("e-ok", PROYECTO_A, FASE_A),
  "e-sin-contacto": entrevista("e-sin-contacto", PROYECTO_B, FASE_B),
};

type Llamada = {
  body: Record<string, unknown> | null;
  idempotency: string | null;
  method: string;
  url: URL;
};
const llamadas: Llamada[] = [];

function responderFila(fila: unknown, headers: Headers) {
  if (!fila) {
    return Response.json([], { status: 200 });
  }
  const accept = headers.get("Accept") ?? "";
  return Response.json(accept.includes("vnd.pgrst.object") ? fila : [fila]);
}

globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url
  );
  const headers = new Headers(init?.headers);
  const method = init?.method ?? "GET";
  const texto = typeof init?.body === "string" ? init.body : null;
  llamadas.push({
    body: texto ? JSON.parse(texto) : null,
    idempotency: headers.get("Idempotency-Key"),
    method,
    url,
  });

  if (url.hostname === "api.resend.com") {
    return Promise.resolve(Response.json({ id: "synthetic-email" }));
  }
  assert.equal(url.hostname, "supabase.example.test");
  const tabla = url.pathname.replace("/rest/v1/", "");
  const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
  if (tabla === "entrevista_correo_incidencia") {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (tabla === "entrevista") {
    return Promise.resolve(responderFila(entrevistas[id], headers));
  }
  if (tabla === "proyecto") {
    return Promise.resolve(responderFila(proyectos[id], headers));
  }
  if (tabla === "fase") {
    return Promise.resolve(responderFila(fases[id], headers));
  }
  throw new Error(`Unexpected request ${url}`);
};

function enviosResend() {
  return llamadas.filter(
    (llamada) => llamada.url.hostname === "api.resend.com"
  );
}

function incidencias() {
  return llamadas.filter((llamada) =>
    llamada.url.pathname.endsWith("entrevista_correo_incidencia")
  );
}

async function rechaza(promesa: Promise<unknown>, motivo: string | RegExp) {
  try {
    await promesa;
  } catch (error) {
    if (typeof motivo === "string") {
      assert.ok(error instanceof CorreoBloqueadoError, String(error));
      assert.equal(error.motivo, motivo);
    } else {
      assert.match(String(error), motivo);
    }
    return;
  }
  assert.fail("expected the send to be refused");
}

async function confirmacion() {
  await enviarCorreoAgradecimiento({
    emailEsperado: "Participant@Example.test ",
    entrevistaId: "e-ok",
  });
  await enviarCorreoAgradecimiento({ entrevistaId: "e-ok" });

  const envios = enviosResend();
  assert.equal(envios.length, 2);
  for (const envio of envios) {
    const body = envio.body ?? {};
    assert.deepEqual(body.to, ["participant@example.test"]);
    assert.deepEqual(body.bcc, ["team@example.test"]);
    assert.equal(
      body.from,
      "Compliance Demo vía Majoriti <sender@example.test>"
    );
    assert.equal(body.reply_to ?? body.replyTo, "ana@cliente.test");
    assert.equal(envio.idempotency, "entrevista-e-ok-agradecimiento");
    assert.equal(body.subject, "Recibimos sus respuestas — Iniciativa 2026");
    const html = String(body.html);
    assert.match(
      html,
      /https:\/\/portal\.example\.test\/marca\/cliente-2026\/logo/
    );
    assert.match(html, /alt="Compliance Demo"/);
    assert.match(html, /#1f4b3a/);
    assert.match(html, /Equipo Compliance Demo/);
    assert.match(html, /Enviado a través de Majoriti/);
    assert.doesNotMatch(html, /Comenzar mi entrevista|token_hash|magiclink/);
    assert.doesNotMatch(html, /Otra Firma/);
    const text = String(body.text);
    assert.match(text, /Hola, Lucía:/);
    assert.match(text, /No necesita hacer nada más/);
    assert.match(text, /ana@cliente\.test/);
  }
  assert.ok(incidencias().every((llamada) => llamada.method === "DELETE"));
}

async function bloqueos() {
  llamadas.length = 0;
  await rechaza(
    enviarCorreoAgradecimiento({
      emailEsperado: "otra.persona@example.test",
      entrevistaId: "e-ok",
    }),
    "destinatario_distinto"
  );
  await rechaza(
    enviarCorreoAgradecimiento({ entrevistaId: "e-mezcla" }),
    "asignacion_inconsistente"
  );
  await rechaza(
    enviarCorreoAgradecimiento({ entrevistaId: "e-sin-contacto" }),
    "sin_contacto"
  );
  await rechaza(
    enviarCorreoAgradecimiento({ entrevistaId: "no-existe" }),
    "sin_entrevista"
  );
  assert.equal(enviosResend().length, 0);
  const avisos = incidencias();
  assert.equal(avisos.length, 4);
  assert.ok(avisos.every((llamada) => llamada.method === "POST"));
}

async function invitaciones() {
  llamadas.length = 0;
  await rechaza(enviarCorreoInvitacion("e-ok"), /no está habilitado/);
  assert.equal(llamadas.length, 0, "a disabled invitation reads nothing");

  process.env.HABILITAR_INVITACIONES_CORREO = "1";
  await enviarCorreoInvitacion("e-ok");
  await rechaza(enviarCorreoInvitacion("e-sin-contacto"), "sin_contacto");
  await rechaza(enviarCorreoInvitacion("e-mezcla"), "asignacion_inconsistente");
  process.env.NEXT_PUBLIC_SITE_URL = "http://portal.example.test";
  await rechaza(enviarCorreoInvitacion("e-ok"), /dominio autorizado/);
  process.env.NEXT_PUBLIC_SITE_URL = "https://portal.example.test";
  process.env.HABILITAR_INVITACIONES_CORREO = "";

  const envios = enviosResend();
  assert.equal(envios.length, 1);
  const body = envios.at(0)?.body ?? {};
  assert.equal(body.bcc, undefined, "invitations are never copied");
  assert.equal(body.reply_to ?? body.replyTo, "ana@cliente.test");
  assert.equal(body.subject, "Invitación de Compliance Demo");
  assert.equal(envios.at(0)?.idempotency, "entrevista-e-ok-invitacion");
  const html = String(body.html);
  assert.match(
    html,
    /href="https:\/\/portal\.example\.test\/cliente-2026\?codigo=1"/
  );
  assert.match(html, /Comenzar mi entrevista/);
  assert.match(html, /aproximadamente 15 minutos/);
  assert.match(html, /código de acceso/);
  assert.equal(incidencias().length, 0);
}

async function main() {
  await confirmacion();
  await bloqueos();
  await invitaciones();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
