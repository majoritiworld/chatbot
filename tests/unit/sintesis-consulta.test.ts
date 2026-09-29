import { expect, test } from "@playwright/test";
import { parseResumen } from "@/lib/consultoria/entrevista-contenido";
import {
  citasLiteralesDelParticipante,
  instruccionesSintesisConsulta,
  parseSintesisConsulta,
  type TurnoParaCita,
} from "@/lib/consultoria/sintesis-consulta";

const cita = "En la práctica las firmas no comparten casos entre sí.";
const turnos: TurnoParaCita[] = [
  {
    rol: "entrevistador",
    texto: "¿Qué evidencia concreta observó en el último año?",
  },
  {
    rol: "entrevistado",
    texto: `\u200b${cita}`,
  },
  {
    rol: "entrevistado",
    texto: "Propondría una reunión trimestral con casos anonimizados.",
  },
];

test("memorable quotes must be literal participant speech", () => {
  const aceptadas = citasLiteralesDelParticipante(
    [
      `«${cita}»`,
      "¿Qué evidencia concreta observó en el último año?",
      "Las firmas casi no comparten casos.",
      "Propondría una reunión trimestral con casos anonimizados.",
      cita,
      "sí",
      "Propondría una reunión trimestral con casos anonimizados.",
    ],
    turnos
  );

  expect(aceptadas).toEqual([
    cita,
    "Propondría una reunión trimestral con casos anonimizados.",
  ]);
});

test("more than four literal quotes keep only the first four", () => {
  const frases = [
    "La primera frase del participante es esta.",
    "La segunda frase del participante es esta.",
    "La tercera frase del participante es esta.",
    "La cuarta frase del participante es esta.",
    "La quinta frase del participante es esta.",
  ];
  const aceptadas = citasLiteralesDelParticipante(
    frases,
    frases.map((texto) => ({ rol: "entrevistado" as const, texto }))
  );

  expect(aceptadas).toEqual(frases.slice(0, 4));
});

test("the consultation prompt forbids inferred answers and invented quotes", () => {
  const instrucciones = instruccionesSintesisConsulta();
  expect(instrucciones).toContain("No infieras");
  expect(instrucciones).toContain("No cites al entrevistador");
  expect(instrucciones).toContain("No reformules");
});

test("a saved consultation summary survives parsing and an empty one does not", () => {
  expect(
    parseSintesisConsulta({
      citas: [cita, 12],
      sintesis: "  Hallazgo principal.  ",
    })
  ).toEqual({
    citas: [cita],
    sintesis: "Hallazgo principal.",
  });
  expect(parseSintesisConsulta({ citas: [], sintesis: "   " })).toBeNull();
  expect(
    parseResumen({
      consulta: { citas: [cita], sintesis: "Hallazgo principal." },
      hallazgos: [],
      respuestas: [],
      sintesis: "Sección: detalle",
    })?.consulta
  ).toEqual({
    citas: [cita],
    sintesis: "Hallazgo principal.",
  });
});
