import assert from "node:assert/strict";
import { enviarCorreoAgradecimiento } from "@/lib/consultoria/email-entrevista";
import type { MarcaPublica } from "@/lib/consultoria/marca";

// Separate process; every network request is replaced. No mail is sent.
process.env.RESEND_API_KEY = "synthetic-key";
process.env.INTERVIEW_EMAIL_FROM = "sender@example.test";
process.env.INTERVIEW_EMAIL_BCC = "team@example.test";
process.env.BLOQUEAR_CORREO_ENTREVISTA = "0";

const marca: MarcaPublica = {
  avisoRespuestas: null,
  color: "#1f4b3a",
  colorTexto: "#fafafa",
  contactoEmail: "ana@cliente.test",
  contactoNombre: "Ana",
  logoSrc: "/marca/cliente-2026/logo",
  nombre: "Compliance Demo",
  personalizada: true,
  slug: "cliente-2026",
  textoBienvenida: null,
  titulo: "Iniciativa 2026",
};

const calls: { body: Record<string, unknown>; idempotency: string | null }[] =
  [];
globalThis.fetch = (input, init) => {
  assert.equal(String(input), "https://api.resend.com/emails");
  const headers = new Headers(init?.headers);
  calls.push({
    body: JSON.parse(String(init?.body)),
    idempotency: headers.get("Idempotency-Key"),
  });
  return Promise.resolve(Response.json({ id: "synthetic-email" }));
};

async function main() {
  const envio = {
    email: "participant@example.test",
    entrevistaId: "synthetic-interview",
    marca,
    nombre: "QA",
  };
  await enviarCorreoAgradecimiento(envio);
  await enviarCorreoAgradecimiento(envio);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.body.to, ["participant@example.test"]);
    assert.deepEqual(call.body.bcc, ["team@example.test"]);
    assert.equal(
      call.idempotency,
      "entrevista-synthetic-interview-agradecimiento"
    );
    assert.match(String(call.body.html), /Compliance Demo/);
    assert.doesNotMatch(String(call.body.subject), /Invitación/);
    assert.doesNotMatch(String(call.body.html), /token_hash|magiclink/);
  }
  assert.equal(calls[0]?.idempotency, calls[1]?.idempotency);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
