import assert from "node:assert/strict";
import {
  enviarCorreoAgradecimiento,
  enviarCorreoInvitacionEntrevista,
} from "@/lib/consultoria/email-entrevista";

// Separate process; every network request is replaced. No mail is sent.
process.env.RESEND_API_KEY = "synthetic-key";
process.env.INTERVIEW_EMAIL_FROM = "sender@example.test";
process.env.INTERVIEW_EMAIL_BCC = "team@example.test";
process.env.BLOQUEAR_CORREO_ENTREVISTA = "0";
const bodies: Record<string, unknown>[] = [];
globalThis.fetch = (input, init) => {
  assert.equal(String(input), "https://api.resend.com/emails");
  bodies.push(JSON.parse(String(init?.body)));
  return Promise.resolve(Response.json({ id: "synthetic-email" }));
};

async function main() {
  await enviarCorreoInvitacionEntrevista({
    email: "participant@example.test",
    nombre: "QA",
    portal: "https://portal.example.test",
  });
  assert.deepEqual(bodies[0].to, ["participant@example.test"]);
  assert.equal(bodies[0].bcc, undefined);
  assert.equal(bodies[0].cc, undefined);
  assert.match(String(bodies[0].html), /https:\/\/portal\.example\.test/);
  assert.doesNotMatch(String(bodies[0].html), /token_hash|magiclink/);
  assert.match(String(bodies[0].text), /código de 8 dígitos/);
  await enviarCorreoAgradecimiento({
    email: "participant@example.test",
    entrevistaId: "synthetic-interview",
    nombre: "QA",
  });
  assert.deepEqual(bodies[1].bcc, ["team@example.test"]);
  assert.equal(bodies.length, 2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
