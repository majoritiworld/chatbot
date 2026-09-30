import { expect, test } from "@playwright/test";
import {
  decidirAntesDelMenu,
  esElogioDeLaPregunta,
  esIncomprension,
  esNoSabe,
  esRenunciaAProfundizar,
  seguimientosSustantivosHechos,
} from "@/lib/consultoria/seguimientos-sustantivos";
import type { ChatMessage } from "@/lib/types";

function mensaje(
  id: string,
  role: "assistant" | "user",
  text: string,
  clase?: "principal" | "seguimiento" | "aclaracion"
): ChatMessage {
  return {
    id,
    parts: [{ text, type: "text" }],
    role,
    ...(clase
      ? { metadata: { clase, createdAt: "2026-09-30T21:01:00.000Z" } }
      : {}),
  };
}

const conversacionCorta = [
  mensaje("a1", "assistant", "¿Quiénes conocen ComplianceLatam?", "principal"),
  mensaje("u1", "user", "no mucho"),
  mensaje("a2", "assistant", "¿Qué otros equipos participan?", "seguimiento"),
  mensaje("u2", "user", "no entendí bien la pregunta"),
  mensaje("a3", "assistant", "¿Hay alguien más que participe?", "aclaracion"),
  mensaje("u3", "user", "no, nadie más"),
];

test("a clarification does not spend a substantive follow-up", () => {
  expect(esIncomprension("no entendí bien la pregunta")).toBe(true);
  expect(esIncomprension("no, nadie más")).toBe(false);
  expect(esIncomprension("no mucho")).toBe(false);
  expect(
    esIncomprension(
      "no entendí por qué nadie de la firma conoce la red ni cómo se enteran de las actividades cuando llega un correo"
    )
  ).toBe(false);
  expect(seguimientosSustantivosHechos(conversacionCorta)).toBe(1);

  const siguiente = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: conversacionCorta,
  });
  expect(siguiente.clase).toBe("consultar");
  expect(siguiente.seguimientosHechos).toBe(1);
  expect(siguiente.forzarOferta).toBe(false);
});

test("praising the question does not count and asks for a concrete reformulation", () => {
  expect(esElogioDeLaPregunta("buena pregunta")).toBe(true);
  expect(esElogioDeLaPregunta("qué buena pregunta")).toBe(true);
  expect(esElogioDeLaPregunta("es una buena pregunta")).toBe(true);
  expect(
    esElogioDeLaPregunta(
      "la prospección de clientes es una buena pregunta para el comité"
    )
  ).toBe(false);

  const trasElogio = [
    mensaje("a1", "assistant", "¿Cómo usan la membresía?", "principal"),
    mensaje("u1", "user", "nos cuesta la prospección"),
    mensaje(
      "a2",
      "assistant",
      "¿Qué han intentado para conseguir clientes?",
      "seguimiento"
    ),
    mensaje("u2", "user", "buena pregunta"),
  ];
  expect(seguimientosSustantivosHechos(trasElogio)).toBe(0);
  const decision = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: trasElogio,
  });
  expect(decision.clase).toBe("aclaracion");
  expect(decision.seguimientosHechos).toBe(0);
  expect(decision.preguntaAReformular).toContain("conseguir clientes");
});

test("the first incomprehension reformulates and the second offers to move on", () => {
  const primera = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: conversacionCorta.slice(0, 4),
  });
  expect(primera.clase).toBe("aclaracion");
  expect(primera.forzarOferta).toBe(false);
  expect(primera.preguntaAReformular).toContain("otros equipos");
  expect(primera.seguimientosHechos).toBe(0);

  const segunda = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: [
      ...conversacionCorta.slice(0, 5),
      mensaje("u4", "user", "sigo sin entender la pregunta"),
    ],
  });
  expect(segunda.clase).toBe("cierre");
  expect(segunda.motivoCierre).toBe("sin_comprension");
});

test("not knowing and declining to go deeper close without claiming the cap", () => {
  expect(esNoSabe("no sé")).toBe(true);
  expect(esNoSabe("no, nadie más")).toBe(false);
  expect(esRenunciaAProfundizar("prefiero pasar al siguiente tema")).toBe(true);

  const noSabe = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: [
      mensaje("a1", "assistant", "¿Quiénes conocen la red?", "principal"),
      mensaje("u1", "user", "no sé"),
    ],
  });
  expect(noSabe.clase).toBe("consultar");

  const renuncia = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: [
      mensaje("a1", "assistant", "¿Quiénes conocen la red?", "principal"),
      mensaje("u1", "user", "prefiero no profundizar"),
    ],
  });
  expect(renuncia.motivoCierre).toBe("no_profundizar");
});

test("three substantive answers reach the partner-firm cap and two do not", () => {
  const base = [
    mensaje("a1", "assistant", "Pregunta", "principal"),
    mensaje("u1", "user", "poco"),
  ];
  const conDos = [
    ...base,
    mensaje("a2", "assistant", "Uno", "seguimiento"),
    mensaje("u2", "user", "así"),
    mensaje("a3", "assistant", "Dos", "seguimiento"),
    mensaje("u3", "user", "más"),
  ];
  expect(
    decidirAntesDelMenu({ maxSeguimientos: 3, messages: conDos }).clase
  ).toBe("consultar");

  const conTres = [
    ...conDos,
    mensaje("a4", "assistant", "Tres", "seguimiento"),
    mensaje("u4", "user", "ya"),
  ];
  const tope = decidirAntesDelMenu({
    maxSeguimientos: 3,
    messages: conTres,
  });
  expect(tope.motivoCierre).toBe("limite");
  expect(tope.seguimientosHechos).toBe(3);
});
