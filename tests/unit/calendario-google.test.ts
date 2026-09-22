import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  avisoCalendario,
  eventoGoogleListo,
  fechaYHoraGoogle,
  participantesGoogle,
} from "@/lib/consultoria/google-evento";
import {
  debeReemplazarMinuta,
  minutaParaPortal,
  verificarFirmaGranola,
} from "@/lib/consultoria/granola-nota";
import {
  empaquetarEstadoOAuth,
  leerEstadoOAuth,
} from "@/lib/consultoria/oauth-estado";
import {
  cifrarSecreto,
  descifrarSecreto,
} from "@/lib/consultoria/token-cifrado";

const SECRETO = "test-secret";
const USUARIO = "10000000-0000-4000-8000-000000000001";
const PROYECTO = "20000000-0000-4000-8000-000000000001";
const CLAVE = Buffer.from("granola-test-key");
const SECRETO_WEBHOOK = `whsec_${CLAVE.toString("base64")}`;

function firmarGranola(id: string, timestamp: string, body: string) {
  const firma = createHmac("sha256", CLAVE)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${firma}`;
}

test("a timed google event keeps its local date and time", () => {
  expect(fechaYHoraGoogle({ dateTime: "2026-01-27T15:30:00-03:00" })).toEqual({
    fecha: "2026-01-27",
    hora: "15:30",
  });
});

test("an all-day google event has no time", () => {
  expect(fechaYHoraGoogle({ date: "2026-01-27" })).toEqual({
    fecha: "2026-01-27",
    hora: null,
  });
});

test("google attendees skip the connected account and blank names", () => {
  expect(
    participantesGoogle([
      { displayName: "Ana Pérez", email: "ana@cliente.test" },
      { email: "yo@majoriti.test", self: true },
      { email: "luis@cliente.test" },
      { displayName: "   " },
    ])
  ).toEqual(["Ana Pérez", "luis@cliente.test"]);
});

test("cancelled google events are ignored", () => {
  expect(
    eventoGoogleListo({
      id: "evt-1",
      start: { date: "2026-01-27" },
      status: "cancelled",
      summary: "Kickoff",
    })
  ).toBeNull();
});

test("oauth state round-trips and rejects tampering", () => {
  const token = empaquetarEstadoOAuth(
    { expira: 2000, proyectoId: PROYECTO, usuarioId: USUARIO },
    SECRETO
  );
  expect(leerEstadoOAuth(token, SECRETO, 1000)).toEqual({
    proyectoId: PROYECTO,
    usuarioId: USUARIO,
  });
  expect(leerEstadoOAuth(token, SECRETO, 2001)).toBeNull();
  expect(leerEstadoOAuth(`${token}x`, SECRETO, 1000)).toBeNull();
});

test("calendar tokens decrypt only with the same secret", () => {
  const cifrado = cifrarSecreto("refresh-token", SECRETO);
  expect(descifrarSecreto(cifrado, SECRETO)).toBe("refresh-token");
  expect(descifrarSecreto(cifrado, "otro")).toBeNull();
});

test("granola summary markdown is the portal note", () => {
  expect(
    minutaParaPortal({
      summary_markdown: "  ## Kickoff\n\nListo.  ",
      summary_text: "Kickoff",
    })
  ).toBe("## Kickoff\n\nListo.");
  expect(
    minutaParaPortal({ summary_markdown: null, summary_text: "Solo texto" })
  ).toBe("Solo texto");
  expect(
    minutaParaPortal({ summary_markdown: "  ", summary_text: "   " })
  ).toBeNull();
});

test("a handwritten note is not replaced by a different granola note", () => {
  expect(
    debeReemplazarMinuta(
      { granolaNoteId: null, minuta: "Escrita a mano" },
      "not_1d3tmYTlCICgjy"
    )
  ).toBe(false);
  expect(
    debeReemplazarMinuta(
      { granolaNoteId: "not_1d3tmYTlCICgjy", minuta: "Anterior" },
      "not_1d3tmYTlCICgjy"
    )
  ).toBe(true);
  expect(
    debeReemplazarMinuta(
      { granolaNoteId: null, minuta: null },
      "not_1d3tmYTlCICgjy"
    )
  ).toBe(true);
});

test("granola webhook signature accepts a fresh body and rejects changes", () => {
  const body = '{"note_id":"not_1d3tmYTlCICgjy"}';
  const timestamp = "1700000000";
  const id = "evt-1";
  const firma = firmarGranola(id, timestamp, body);
  expect(
    verificarFirmaGranola({
      ahoraSegundos: 1_700_000_000,
      body,
      firma,
      id,
      secreto: SECRETO_WEBHOOK,
      timestamp,
    })
  ).toBe(true);
  expect(
    verificarFirmaGranola({
      ahoraSegundos: 1_700_000_000,
      body: "{}",
      firma,
      id,
      secreto: SECRETO_WEBHOOK,
      timestamp,
    })
  ).toBe(false);
  expect(
    verificarFirmaGranola({
      ahoraSegundos: 1_700_000_400,
      body,
      firma,
      id,
      secreto: SECRETO_WEBHOOK,
      timestamp,
    })
  ).toBe(false);
});

test("unknown calendar callback codes stay quiet", () => {
  expect(avisoCalendario("ok")).toBe("Google Calendar conectado.");
  expect(avisoCalendario("no-existe")).toBeNull();
});
