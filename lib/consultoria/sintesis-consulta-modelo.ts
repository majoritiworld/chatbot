import "server-only";

import { generateText, Output } from "ai";
import {
  entrevistaSimuladaLocal,
  sintesisConsultaSimulada,
} from "@/lib/ai/entrevista-simulada";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { textoConversacionCierre } from "@/lib/consultoria/cierre-seccion";
import type { TurnoEntrevista } from "@/lib/consultoria/entrevista-contenido";
import {
  instruccionesSintesisConsulta,
  sintesisConsultaSchema,
} from "@/lib/consultoria/sintesis-consulta";

export async function generarSintesisConsulta({
  signal,
  turnos,
}: {
  signal?: AbortSignal;
  turnos: TurnoEntrevista[];
}) {
  if (entrevistaSimuladaLocal()) {
    return sintesisConsultaSimulada(turnos);
  }
  const { output } = await generateText({
    abortSignal: signal,
    instructions: instruccionesSintesisConsulta(),
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    output: Output.object({ schema: sintesisConsultaSchema }),
    prompt:
      textoConversacionCierre(turnos) ||
      "No hay texto hablado en esta entrevista.",
  });

  if (!output?.sintesis.trim()) {
    throw new Error("No se pudo preparar el resumen");
  }

  return output;
}
