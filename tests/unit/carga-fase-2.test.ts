import { expect, test } from "@playwright/test";
import {
  aplicarPlan,
  resumirPlan,
} from "@/lib/consultoria/carga-participantes";
import {
  DESTINO_CL_FASE_2,
  PARTICIPANTES_CL_FASE_2,
  validarCargaComplianceLatamFase2,
} from "@/lib/consultoria/cargas/compliance-latam-fase-2";

test("the prepared phase 2 roster is planned and not written", () => {
  const plan = validarCargaComplianceLatamFase2({
    almacen: { cargo: true, pais: true },
    destino: {
      faseId: "fase-2-preparada",
      plantillaId: null,
      plantillaNombre: DESTINO_CL_FASE_2.plantillaNombre,
    },
    existentes: [],
  });
  const resumen = resumirPlan(plan);

  expect(PARTICIPANTES_CL_FASE_2).toHaveLength(35);
  expect(resumen.personas).toBe(35);
  expect(resumen.correosEnviados).toBe(0);
  expect(resumen.escrito).toBe(false);
  expect(resumen.rolesSenalados).toEqual([]);
  expect(resumen.entrevistasNuevas).toBe(35);
  expect(aplicarPlan(plan, []).aplicado).toBe(false);
  expect(resumen.avisos).toEqual([
    `La plantilla «${DESTINO_CL_FASE_2.plantillaNombre}» no está creada. La asignación queda preparada.`,
  ]);

  const textos = resumen.revisiones.map((revision) => revision.texto);
  expect(textos).toEqual([
    "El nombre tiene más de dos palabras. No separo nombre y apellido.",
    "El nombre tiene más de dos palabras. No separo nombre y apellido.",
    "El nombre tiene más de dos palabras. No separo nombre y apellido.",
    "La firma usa el carácter ´, no un apóstrofo. Se conserva «D´Empaire».",
    "La firma usa el carácter ´, no un apóstrofo. Se conserva «D´Empaire».",
    "El correo no coincide con el apellido «Jazquez». Se conservan ambos textos.",
    "La grafía habitual es República Dominicana. Se conserva el texto entregado.",
    "La grafía habitual es República Dominicana. Se conserva el texto entregado.",
    "El correo no coincide con el apellido «Lethman». Se conservan ambos textos.",
    "La firma trae «thornburg» en minúscula. Se conserva el texto entregado.",
    "La firma trae «thornburg» en minúscula. Se conserva el texto entregado.",
    "El nombre tiene más de dos palabras. No separo nombre y apellido.",
    "El correo incluye «silanes», que no está en el nombre entregado. Se conserva el correo.",
    "El nombre tiene más de dos palabras. No separo nombre y apellido.",
    "«Lopéz» lleva la tilde en la e. Se conserva tal como viene.",
    "El correo no coincide con el apellido «Mizrachi». Se conservan ambos textos.",
    "La grafía habitual es Panamá. Se conserva «Panama».",
    "El correo no coincide con el apellido «Narkiss». Se conservan ambos textos.",
    "La grafía habitual es Panamá. Se conserva «Panama».",
  ]);
  expect(resumen.firmas).toBe(14);
  expect(resumen.presencias).toBe(19);
});
