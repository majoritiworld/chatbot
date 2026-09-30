import "server-only";

import {
  type ResumenSeccionPrevia,
  textoSeccionesPrevias,
} from "@/lib/ai/prompts";
import {
  debeForzarOfertaCierre,
  herramientasCierreActivas,
  ofertaCierreVigenteEnChat,
  respuestasEnSeccion,
  seguimientosHechosEnSeccion,
  textoConversacionCierre,
} from "@/lib/consultoria/cierre-seccion";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import { resolverTurnoConObligatorias } from "@/lib/consultoria/obligatorias-turno";
import {
  obligatoriasYaCubiertas,
  siguienteSeguimiento,
} from "@/lib/consultoria/seguimientos-elegibles";
import type { ChatMessage } from "@/lib/types";

const OFERTA = "ofrecerCierreSeccion";

export type PlanSeguimientos = {
  clase: "principal" | "obligatoria" | "seguimiento" | "cierre";
  forzarOferta: boolean;
  indiceObligatoria?: number;
  /** Set when the flow decided to ask this follow-up now. */
  seguimientoSiguiente?: string;
  seguimientosHechos: number;
};

/**
 * Decides, before the agent speaks, whether a follow-up may still be asked
 * and which one. The cap and the "nothing left to ask" case are enforced
 * here, not left to the prompt.
 */
export async function planificarSeguimientos({
  messages,
  seccion,
  seccionesPrevias,
}: {
  messages: ChatMessage[];
  seccion: SeccionEntrevista;
  seccionesPrevias: ResumenSeccionPrevia[];
}): Promise<PlanSeguimientos> {
  const seguimientos = seccion.seguimientos ?? [];
  const obligatorias = seccion.obligatorias ?? [];
  const seguimientosHechos = seguimientosHechosEnSeccion(messages);
  const tieneSeguimientos = seguimientos.length > 0;

  if (obligatorias.length > 0) {
    return await planificarObligatorias({
      messages,
      obligatorias,
      seccion,
      seccionesPrevias,
      seguimientos,
      tieneSeguimientos,
    });
  }

  if (debeForzarOfertaCierre({ messages, tieneSeguimientos })) {
    return { clase: "cierre", forzarOferta: true, seguimientosHechos };
  }

  const [herramienta, ...otras] = herramientasCierreActivas(messages);
  const flujoNormal = herramienta === OFERTA && otras.length === 0;
  if (
    !(tieneSeguimientos && flujoNormal && respuestasEnSeccion(messages) > 0)
  ) {
    return {
      clase: "principal",
      forzarOferta: false,
      seguimientosHechos,
    };
  }
  // Once the close was offered the section does not reopen with new questions.
  if (ofertaCierreVigenteEnChat(messages)) {
    return { clase: "cierre", forzarOferta: true, seguimientosHechos };
  }

  const turnos = mensajesATurnos(messages);
  const siguiente = await siguienteSeguimiento({
    conversacion: textoConversacionCierre(turnos),
    dichoPorLaPersona: turnos
      .filter((turno) => turno.rol === "entrevistado")
      .map((turno) => turno.texto)
      .join("\n"),
    preguntaPrincipal: seccion.preguntas.join(" "),
    previas: textoSeccionesPrevias(seccionesPrevias),
    seguimientos,
  });
  if (siguiente === undefined) {
    return { clase: "cierre", forzarOferta: false, seguimientosHechos };
  }
  if (siguiente === null) {
    return { clase: "cierre", forzarOferta: true, seguimientosHechos };
  }
  return {
    clase: "seguimiento",
    forzarOferta: false,
    seguimientoSiguiente: siguiente,
    seguimientosHechos,
  };
}

async function planificarObligatorias({
  messages,
  obligatorias,
  seccion,
  seccionesPrevias,
  seguimientos,
  tieneSeguimientos,
}: {
  messages: ChatMessage[];
  obligatorias: string[];
  seccion: SeccionEntrevista;
  seccionesPrevias: ResumenSeccionPrevia[];
  seguimientos: string[];
  tieneSeguimientos: boolean;
}): Promise<PlanSeguimientos> {
  const [herramienta, ...otras] = herramientasCierreActivas(messages);
  const flujoNormal = herramienta === OFERTA && otras.length === 0;
  const hechos = seguimientosHechosEnSeccion(messages);
  if (!flujoNormal) {
    return { clase: "cierre", forzarOferta: false, seguimientosHechos: hechos };
  }
  if (ofertaCierreVigenteEnChat(messages)) {
    return { clase: "cierre", forzarOferta: true, seguimientosHechos: hechos };
  }

  const turnos = mensajesATurnos(messages);
  const conversacion = textoConversacionCierre(turnos);
  const dichoPorLaPersona = turnos
    .filter((turno) => turno.rol === "entrevistado")
    .map((turno) => turno.texto)
    .join("\n");
  const previas = textoSeccionesPrevias(seccionesPrevias);
  const cubiertas =
    respuestasEnSeccion(messages) > 0
      ? await obligatoriasYaCubiertas({
          conversacion,
          dichoPorLaPersona,
          obligatorias,
          previas,
        })
      : [];

  let seguimientoOpcional: string | null | undefined;
  const decisionPrevia = resolverTurnoConObligatorias({
    cubiertas: cubiertas ?? [],
    messages,
    obligatorias,
    seguimientoOpcional: undefined,
    tieneSeguimientos,
  });
  if (decisionPrevia.preguntarOpcional && tieneSeguimientos) {
    seguimientoOpcional = await siguienteSeguimiento({
      conversacion,
      dichoPorLaPersona,
      preguntaPrincipal: seccion.preguntas.join(" "),
      previas,
      seguimientos,
    });
  }

  const decision = resolverTurnoConObligatorias({
    cubiertas: cubiertas ?? [],
    messages,
    obligatorias,
    seguimientoOpcional,
    tieneSeguimientos,
  });
  return {
    clase: decision.clase,
    forzarOferta: decision.forzarOferta,
    ...(typeof decision.indiceObligatoria === "number"
      ? { indiceObligatoria: decision.indiceObligatoria }
      : {}),
    ...(decision.seguimientoSiguiente
      ? { seguimientoSiguiente: decision.seguimientoSiguiente }
      : {}),
    seguimientosHechos: decision.seguimientosHechos,
  };
}
