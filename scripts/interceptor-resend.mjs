/**
 * Local stand-in for the Resend API. Nothing leaves the machine.
 * Point RESEND_BASE_URL at http://127.0.0.1:54329.
 *
 *   POST /emails          Stores the mail. Same Idempotency-Key, same id, no new mail.
 *   POST /__fallar        {"veces": n, "estado": 500} fails the next n sends.
 *   GET  /__correos       Accepted mails, in order.
 *
 *   CORREOS_DIR=/tmp/etm-correos node scripts/interceptor-resend.mjs
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const PUERTO = Number(process.env.PUERTO_INTERCEPTOR ?? 54_329);
const DIR = process.env.CORREOS_DIR ?? "/tmp/etm-correos";
mkdirSync(DIR, { recursive: true });

const porClave = new Map();
const aceptados = [];
let fallos = { estado: 500, veces: 0 };

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

async function leer(req) {
  const partes = [];
  for await (const parte of req) {
    partes.push(parte);
  }
  const texto = Buffer.concat(partes).toString("utf8");
  return texto ? JSON.parse(texto) : {};
}

function guardar(correo) {
  const n = String(aceptados.length).padStart(2, "0");
  const base = join(DIR, `${n}-${correo.id}`);
  writeFileSync(`${base}.json`, JSON.stringify(correo, null, 2));
  writeFileSync(`${base}.html`, correo.html ?? "");
}

const servidor = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/__correos") {
      responder(res, 200, aceptados);
      return;
    }
    if (req.method === "POST" && req.url === "/__fallar") {
      const cuerpo = await leer(req);
      fallos = { estado: cuerpo.estado ?? 500, veces: cuerpo.veces ?? 1 };
      responder(res, 200, fallos);
      return;
    }
    if (req.method === "POST" && req.url === "/emails") {
      const cuerpo = await leer(req);
      const clave = req.headers["idempotency-key"];
      if (fallos.veces > 0) {
        fallos.veces -= 1;
        responder(res, fallos.estado, {
          message: "Fallo simulado por el interceptor",
          name: "application_error",
          statusCode: fallos.estado,
        });
        return;
      }
      if (clave && porClave.has(clave)) {
        responder(res, 200, { id: porClave.get(clave) });
        return;
      }
      const id = randomUUID();
      if (clave) {
        porClave.set(clave, id);
      }
      const correo = {
        bcc: cuerpo.bcc ?? null,
        cc: cuerpo.cc ?? null,
        clave: clave ?? null,
        from: cuerpo.from,
        html: cuerpo.html,
        id,
        recibido: new Date().toISOString(),
        replyTo: cuerpo.reply_to ?? cuerpo.replyTo ?? null,
        subject: cuerpo.subject,
        text: cuerpo.text,
        to: cuerpo.to,
      };
      aceptados.push(correo);
      guardar(correo);
      responder(res, 200, { id });
      return;
    }
    responder(res, 404, { message: "No encontrado", statusCode: 404 });
  } catch (error) {
    responder(res, 500, { message: String(error), statusCode: 500 });
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  process.stdout.write(`interceptor en http://127.0.0.1:${PUERTO} → ${DIR}\n`);
});
