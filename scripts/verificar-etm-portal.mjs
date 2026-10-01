/**
 * Local walkthrough of ETM on the portal branch, with the real agent and the
 * Resend interceptor. Opens the links from the intercepted invitations.
 * Never touches a remote database or real mail.
 *
 *   set -a && source /Users/salbagli/Projects/consulting/.env.white-label.local && set +a
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 node scripts/verificar-etm-portal.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_VERIFICACION ?? "http://127.0.0.1:3120";
const INTERCEPTOR = "http://127.0.0.1:54329";
const CORREOS = process.env.CORREOS_DIR ?? "/tmp/etm-correos";
const SALIDA = process.env.SALIDA_VERIFICACION ?? "/tmp/etm-verificacion";
const RONDA = process.env.RONDA ?? "2";
const SLUG = process.env.SLUG_ETM ?? "etm-tuesday-recorrido";

for (const url of [BASE, INTERCEPTOR, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(url ?? "").hostname)) {
    throw new Error(`Solo local: ${url}`);
  }
}
mkdirSync(SALIDA, { recursive: true });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO = /\bdemo\b|prueba/i;
const AGRADECIMIENTO = /recibimos tus respuestas/i;
const OPCIONES = /¿[^?]*,[^?]*\bo\b[^?]*\?|\bo algo así\b|\bo quizás\b/i;
const CAUSAS =
  /falta de tiempo|te falt[oó]|informaci[oó]n|recursos|apoyo|claridad|organizaci[oó]n/i;
const resultados = [];

function comprobar(caso, ok, detalle) {
  resultados.push({ caso, detalle, ok: Boolean(ok) });
  console.log(ok ? "OK   " : "FALLA", caso, "—", detalle);
}

function correosDe(email) {
  return readdirSync(CORREOS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(CORREOS, f), "utf8")))
    .filter((c) => c.to.includes(email));
}

function enlaceDe(email) {
  const invitacion = correosDe(email).find(
    (c) => !AGRADECIMIENTO.test(c.subject)
  );
  const enlace = invitacion?.text.match(/https:\/\/[^\s]+\/e\/[\w-]+/)?.[0];
  if (!enlace) {
    throw new Error(`Sin invitación interceptada para ${email}`);
  }
  return enlace.replace("https://portal.majoriti.world", BASE);
}

async function entrevistaDe(email) {
  const { data, error } = await admin
    .from("stakeholder")
    .select(
      "entrevista:entrevista(id, transcripcion, estado, flujo_estado, consentimiento_en, correo_agradecimiento_en)"
    )
    .eq("email", email)
    .single();
  if (error) {
    throw new Error(error.message);
  }
  const [e] = [data.entrevista].flat();
  return { ...e, turnos: e?.transcripcion ?? [] };
}

const ultimoAgente = (turnos) =>
  turnos.filter((t) => t.rol === "entrevistador").at(-1);
const asistentes = (page) => page.locator("[data-testid='message-assistant']");

async function listo(page) {
  await expect(page.locator("[data-chat-status='ready']").first()).toBeVisible({
    timeout: 90_000,
  });
}

async function abrir(page, enlace) {
  await page.goto(enlace);
  await expect(asistentes(page).first()).toContainText("¿Comenzamos?", {
    timeout: 90_000,
  });
  await listo(page);
}

async function escribirYEnviar(page, texto) {
  await listo(page);
  await page.locator("[data-testid='multimodal-input']").fill(texto);
  await page.locator("[data-testid='send-button']").click();
}

async function antesDeEmpezar(page, texto) {
  const antes = await asistentes(page).count();
  const inicio = page.waitForResponse((r) =>
    r.url().includes("/api/entrevista/inicio")
  );
  await escribirYEnviar(page, texto);
  const cuerpo = await (await inicio).json();
  await expect(asistentes(page)).toHaveCount(antes + 1, { timeout: 90_000 });
  await listo(page);
  return {
    iniciada: Boolean(cuerpo.iniciada),
    texto: await asistentes(page).last().innerText(),
  };
}

async function turno(page, email, texto) {
  const antes = await asistentes(page).count();
  const chat = page.waitForResponse(
    (r) => r.url().includes("/api/chat") && r.request().method() === "POST",
    { timeout: 90_000 }
  );
  await escribirYEnviar(page, texto);
  await (await chat).finished();
  await expect(asistentes(page)).toHaveCount(antes + 1, { timeout: 90_000 });
  await listo(page);
  const agente = ultimoAgente((await entrevistaDe(email)).turnos);
  const linea = {
    agente: String(agente?.texto ?? "").replaceAll("\n", " "),
    clase: agente?.clase ?? "cierre",
    indice: agente?.indiceObligatoria ?? null,
  };
  console.log(
    "   ",
    texto.slice(0, 50),
    "→",
    linea.clase,
    linea.indice,
    "|",
    linea.agente
  );
  return linea;
}

async function revisarMarca(page, caso) {
  const logo = page.locator(`img[src*='/marca/${SLUG}/logo']`).first();
  await expect(logo).toBeVisible({ timeout: 30_000 });
  const medida = await logo.evaluate((img) => ({
    alto: img.getBoundingClientRect().height,
    ancho: img.getBoundingClientRect().width,
    natural: img.naturalWidth,
    naturalAlto: img.naturalHeight,
  }));
  const proporcion = medida.ancho / medida.alto;
  comprobar(
    `${caso}: logo ETM visible y sin deformar`,
    medida.natural === 2084 && Math.abs(proporcion - 2084 / 542) < 0.08,
    `${Math.round(medida.ancho)}×${Math.round(medida.alto)} px en pantalla, original ${medida.natural}×${medida.naturalAlto}`
  );
  const texto = await page.locator("body").innerText();
  comprobar(
    `${caso}: sin «demo» ni «prueba» en pantalla`,
    !DEMO.test(texto),
    "texto visible"
  );
}

function revisarDificultad(caso, linea) {
  comprobar(
    `${caso}: dificultad sin opciones ni causas sugeridas`,
    linea.agente.trim().endsWith("?") &&
      !OPCIONES.test(linea.agente) &&
      !CAUSAS.test(linea.agente),
    linea.agente
  );
}

async function fallarCorreo(veces) {
  await fetch(`${INTERCEPTOR}/__fallar`, {
    body: JSON.stringify({ estado: 500, veces }),
    method: "POST",
  });
}

function revisarAgradecimiento(caso, email) {
  const gracias = correosDe(email).filter((correo) =>
    AGRADECIMIENTO.test(correo.subject)
  );
  const c = gracias.at(0);
  comprobar(
    `${caso}: un solo agradecimiento`,
    gracias.length === 1,
    `${gracias.length} correo(s): ${c?.subject ?? "-"}`
  );
  if (!c) {
    return;
  }
  const html = c.html.replace(/<title>[^<]*<\/title>/, "");
  comprobar(
    `${caso}: agradecimiento con marca, tú, sin copia ni promoción`,
    !(c.bcc || c.cc) &&
      c.replyTo === "seba@majoriti.world" &&
      html.includes(`/marca/${SLUG}/logo`) &&
      AGRADECIMIENTO.test(c.subject) &&
      !/Conozca Majoriti|Su entrevista/.test(c.text) &&
      !DEMO.test(c.text),
    `from ${c.from}, replyTo ${c.replyTo}, bcc ${c.bcc}`
  );
}

const browser = await chromium.launch();
const escritorio = { viewport: { height: 820, width: 1280 } };
const movil = {
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  viewport: { height: 844, width: 390 },
};

// Rodrigo, mentor, desktop: consent, difficulty, save and resume, normal finish.
{
  const email = `verificacion.mentor.r${RONDA}@example.test`;
  const ctx = await browser.newContext(escritorio);
  const page = await ctx.newPage();
  const enlace = enlaceDe(email);
  await abrir(page, enlace);
  comprobar(
    "mentor: el enlace abre el chat con saludo personal",
    new URL(page.url()).pathname.startsWith("/e/") ||
      page.url().includes("/entrevista"),
    `${(await asistentes(page).first().innerText()).slice(0, 140)}…`
  );
  comprobar(
    "mentor: sin pasos previos",
    (await page
      .getByRole("button", { name: /Continuar|Aceptar y empezar/ })
      .count()) === 0,
    "no hay botón Continuar ni Aceptar"
  );
  await revisarMarca(page, "mentor escritorio");
  await page.screenshot({ path: `${SALIDA}/escritorio-inicio.png` });

  const privacidad = await antesDeEmpezar(
    page,
    "¿Quién va a ver mis respuestas?"
  );
  let db = await entrevistaDe(email);
  comprobar(
    "mentor: privacidad antes de empezar, sin registrar aceptación",
    !privacidad.iniciada &&
      /Majoriti/.test(privacidad.texto) &&
      !/equipo de EtM/i.test(privacidad.texto) &&
      !db.consentimiento_en,
    privacidad.texto.replaceAll("\n", " ")
  );
  const si = await antesDeEmpezar(page, "Sí, empecemos");
  db = await entrevistaDe(email);
  comprobar(
    "mentor: aceptación registrada al empezar",
    si.iniciada && Boolean(db.consentimiento_en),
    `consentimiento ${db.consentimiento_en}`
  );

  revisarDificultad(
    "mentor",
    await turno(
      page,
      email,
      "Uf, no sé bien qué decir, me cuesta responder esto."
    )
  );
  await turno(
    page,
    email,
    "Me motivó devolver algo de lo que recibí cuando partí: alguien me ayudó a ordenar mis números y quise hacer lo mismo."
  );
  const guardados = (await entrevistaDe(email)).turnos.length;
  await page.reload();
  await expect(asistentes(page).last()).toBeVisible({ timeout: 60_000 });
  await listo(page);
  db = await entrevistaDe(email);
  const ultimaGuardada = String(ultimoAgente(db.turnos)?.texto ?? "").trim();
  const ultimaVisible = (await asistentes(page).last().innerText()).trim();
  comprobar(
    "mentor: recargar retoma donde iba",
    db.turnos.length === guardados &&
      ultimaGuardada.length > 0 &&
      ultimaVisible.includes(ultimaGuardada.slice(0, 60)),
    `${db.turnos.length} turnos guardados; última pregunta visible: ${ultimaVisible.slice(0, 90)}`
  );

  const respuestas = [
    "La conversación fue buena: el emprendedor llegó con dudas de precios y salimos con dos cambios concretos para probar esa semana.",
    "Me habría ayudado saber antes en qué etapa estaba su negocio, para preparar ejemplos más cercanos.",
    "Que se mantenga el uno a uno y que haya una forma simple de saber cómo le fue después.",
    "Nada más, gracias.",
    "No, eso es todo.",
    "No tengo más que agregar.",
  ];
  let ultimo = null;
  for (const texto of respuestas) {
    if (
      // biome-ignore lint/performance/noAwaitInLoops: each answer waits for the previous reply
      await page.locator("[data-testid='entrevista-cerrar-tema']").isVisible()
    ) {
      break;
    }
    ultimo = await turno(page, email, texto);
    if (ultimo.clase === "cierre") {
      break;
    }
  }
  const boton = page.locator("[data-testid='entrevista-cerrar-tema']");
  await expect(boton).toBeVisible({ timeout: 90_000 });
  db = await entrevistaDe(email);
  comprobar(
    "mentor: el cierre no envía solo",
    db.estado === "abierta",
    `estado ${db.estado}`
  );
  await boton.dblclick();
  await expect
    .poll(async () => (await entrevistaDe(email)).estado, { timeout: 90_000 })
    .toBe("completada");
  await expect(page.getByText("Entrevista enviada")).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  await revisarMarca(page, "mentor agradecimiento en pantalla");
  await page.screenshot({ path: `${SALIDA}/escritorio-gracias.png` });
  await page.reload();
  await page.waitForTimeout(4000);
  const entrevistaId = (await entrevistaDe(email)).id;
  const reenvio = await page.evaluate(async (id) => {
    const r = await fetch("/api/entrevista/enviar", {
      body: JSON.stringify({ entrevistaId: id, soloCorreo: true }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return { cuerpo: await r.text(), estado: r.status };
  }, entrevistaId);
  console.log(
    "    reintento manual del agradecimiento:",
    reenvio.estado,
    reenvio.cuerpo.slice(0, 120)
  );
  await page.waitForTimeout(2000);
  revisarAgradecimiento("mentor (tras doble clic, recarga y reintento)", email);
  comprobar(
    "mentor: agradecimiento marcado como enviado",
    Boolean((await entrevistaDe(email)).correo_agradecimiento_en),
    `${(await entrevistaDe(email)).correo_agradecimiento_en}`
  );
  await ctx.close();
}

// Valentina, mentoreada, mobile: difficulty, early finish with failing mail, retry.
{
  const email = `verificacion.mentoreada.r${RONDA}@example.test`;
  const ctx = await browser.newContext(movil);
  const page = await ctx.newPage();
  await abrir(page, enlaceDe(email));
  await revisarMarca(page, "mentoreada móvil");
  await page.screenshot({ path: `${SALIDA}/movil-inicio.png` });
  await antesDeEmpezar(page, "Sí");
  revisarDificultad(
    "mentoreada",
    await turno(page, email, "No sé, la verdad me cuesta explicarlo.")
  );
  await turno(
    page,
    email,
    "Necesitaba ordenar los precios de mi taller y entender a qué cliente apuntar primero."
  );
  await fallarCorreo(3);
  await page.locator("[data-testid='entrevista-terminar']").click();
  const confirmar = page.locator(
    "[data-testid='entrevista-confirmar-cierre-anticipado']"
  );
  await expect(confirmar).toBeVisible({ timeout: 30_000 });
  comprobar(
    "mentoreada: terminar pide confirmación",
    true,
    "diálogo de confirmación visible"
  );
  await confirmar.click();
  await expect
    .poll(async () => (await entrevistaDe(email)).estado, { timeout: 90_000 })
    .toBe("completada");
  const reintentar = page.getByRole("button", { name: "Reintentar correo" });
  await expect(reintentar).toBeVisible({ timeout: 60_000 });
  comprobar(
    "mentoreada: correo fallido avisa y no se marca como enviado",
    !(await entrevistaDe(email)).correo_agradecimiento_en &&
      correosDe(email).filter((c) => AGRADECIMIENTO.test(c.subject)).length ===
        0,
    "botón «Reintentar correo» visible"
  );
  await fallarCorreo(0);
  await reintentar.click();
  await expect(
    page.getByText("Te enviamos un correo de confirmación.")
  ).toBeVisible({
    timeout: 60_000,
  });
  await page.screenshot({ path: `${SALIDA}/movil-gracias.png` });
  await page.reload();
  await page.waitForTimeout(4000);
  revisarAgradecimiento("mentoreada (tras fallo y reintento)", email);
  await ctx.close();
}

// Teresa, sponsor: difficulty in her own terms, draft protection.
{
  const email = `verificacion.sponsor.r${RONDA}@example.test`;
  const ctx = await browser.newContext(escritorio);
  const page = await ctx.newPage();
  await abrir(page, enlaceDe(email));
  await antesDeEmpezar(page, "Sí");
  const linea = await turno(page, email, "Mmm, no sabría qué responder a eso.");
  revisarDificultad("sponsor", linea);
  comprobar(
    "sponsor: no le habla de mentoría propia",
    !/tu mentor[ií]a|como mentor/i.test(linea.agente),
    linea.agente
  );
  const borrador = "Para nosotros el valor estuvo en conocer emprendedores de";
  await page.locator("[data-testid='multimodal-input']").fill(borrador);
  await page.locator("[data-testid='entrevista-terminar']").click();
  const aviso = page.locator("[data-testid='entrevista-aviso-borrador']");
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  comprobar(
    "sponsor: terminar con texto sin enviar avisa del borrador",
    true,
    (await aviso.innerText()).replaceAll("\n", " ")
  );
  await page.keyboard.press("Escape");
  let salida = null;
  page.on("dialog", async (dialog) => {
    salida = dialog.type();
    await dialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  comprobar(
    "sponsor: salir con texto sin enviar pide confirmación",
    salida === "beforeunload",
    `diálogo ${salida ?? "ninguno"}`
  );
  const tras = await entrevistaDe(email);
  comprobar(
    "sponsor: la entrevista sigue abierta",
    tras.estado === "abierta",
    `estado ${tras.estado}`
  );
  await ctx.close();
}

// Carla, mentor, mobile: start screen only. Stays open.
{
  const email = `verificacion.mentor-movil.r${RONDA}@example.test`;
  const ctx = await browser.newContext(movil);
  const page = await ctx.newPage();
  await abrir(page, enlaceDe(email));
  await revisarMarca(page, "mentor móvil");
  await ctx.close();
}

await browser.close();
writeFileSync(
  join(SALIDA, "resultados.json"),
  JSON.stringify(resultados, null, 2)
);
const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK`);
process.exitCode = fallas.length ? 1 : 0;
