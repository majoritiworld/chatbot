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
import {
  decidirAntesDelMenu,
  esNoSabe,
  type MotivoCierreSeccion,
} from "@/lib/consultoria/seguimientos-sustantivos";
import type { ChatMessage } from "@/lib/types";

const OFERTA = "ofrecerCierreSeccion";

export type PlanSeguimientos = {
  clase: "principal" | "obligatoria" | "seguimiento" | "cierre" | "aclaracion";
  forzarOferta: boolean;
  indiceObligatoria?: number;
  /** Partner-firm turns formulate the follow-up; the menu is only a reference. */
  formulacionLibre?: boolean;
  motivoCierre?: MotivoCierreSeccion;
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

  if (typeof seccion.maxSeguimientos === "number") {
    return planificarConTopeSustantivo({
      maxSeguimientos: seccion.maxSeguimientos,
      messages,
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

function textoMensaje(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function planificarConTopeSustantivo({
  maxSeguimientos,
  messages,
  tieneSeguimientos,
}: {
  maxSeguimientos: number;
  messages: ChatMessage[];
  tieneSeguimientos: boolean;
}): PlanSeguimientos {
  const [herramienta, ...otras] = herramientasCierreActivas(messages);
  const flujoNormal = herramienta === OFERTA && otras.length === 0;
  if (!(flujoNormal && respuestasEnSeccion(messages) > 0)) {
    return {
      clase: "principal",
      forzarOferta: false,
      seguimientosHechos: 0,
    };
  }
  const decision = decidirAntesDelMenu({ maxSeguimientos, messages });
  if (ofertaCierreVigenteEnChat(messages)) {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: decision.motivoCierre ?? "suficiente",
      seguimientosHechos: decision.seguimientosHechos,
    };
  }
  if (decision.clase === "aclaracion") {
    return {
      clase: "aclaracion",
      forzarOferta: false,
      seguimientoSiguiente: decision.preguntaAReformular,
      seguimientosHechos: decision.seguimientosHechos,
    };
  }
  if (decision.clase === "cierre") {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: decision.motivoCierre,
      seguimientosHechos: decision.seguimientosHechos,
    };
  }
  if (!tieneSeguimientos) {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: "suficiente",
      seguimientosHechos: decision.seguimientosHechos,
    };
  }

  const ultimo = messages.findLast((message) => message.role === "user");
  if (esNoSabe(ultimo ? textoMensaje(ultimo) : "")) {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: "no_sabe",
      seguimientosHechos: decision.seguimientosHechos,
    };
  }
  return {
    clase: "seguimiento",
    formulacionLibre: true,
    forzarOferta: false,
    seguimientosHechos: decision.seguimientosHechos,
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
