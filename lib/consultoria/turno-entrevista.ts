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
import { siguienteSeguimiento } from "@/lib/consultoria/seguimientos-elegibles";
import type { ChatMessage } from "@/lib/types";

const OFERTA = "ofrecerCierreSeccion";

export type PlanSeguimientos = {
  forzarOferta: boolean;
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
  const seguimientosHechos = seguimientosHechosEnSeccion(messages);
  const tieneSeguimientos = seguimientos.length > 0;

  if (debeForzarOfertaCierre({ messages, tieneSeguimientos })) {
    return { forzarOferta: true, seguimientosHechos };
  }

  const [herramienta, ...otras] = herramientasCierreActivas(messages);
  const flujoNormal = herramienta === OFERTA && otras.length === 0;
  if (
    !(tieneSeguimientos && flujoNormal && respuestasEnSeccion(messages) > 0)
  ) {
    return { forzarOferta: false, seguimientosHechos };
  }
  // Once the close was offered the section does not reopen with new questions.
  if (ofertaCierreVigenteEnChat(messages)) {
    return { forzarOferta: true, seguimientosHechos };
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
    return { forzarOferta: false, seguimientosHechos };
  }
  if (siguiente === null) {
    return { forzarOferta: true, seguimientosHechos };
  }
  return {
    forzarOferta: false,
    seguimientoSiguiente: siguiente,
    seguimientosHechos,
  };
}
