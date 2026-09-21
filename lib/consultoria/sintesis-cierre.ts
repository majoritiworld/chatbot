import "server-only";

import { generateText, Output } from "ai";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  cierreSeccionInputSchema,
  instruccionesSintesisCierre,
  textoConversacionCierre,
} from "@/lib/consultoria/cierre-seccion";
import type { TurnoEntrevista } from "@/lib/consultoria/entrevista-contenido";

export async function generarResumenCierreSeccion({
  forzar,
  preguntas,
  tituloSeccion,
  turnos,
}: {
  forzar: boolean;
  preguntas: string[];
  tituloSeccion: string;
  turnos: TurnoEntrevista[];
}) {
  const { output } = await generateText({
    instructions: instruccionesSintesisCierre({
      forzar,
      preguntas,
      tituloSeccion,
    }),
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    output: Output.object({ schema: cierreSeccionInputSchema }),
    prompt:
      textoConversacionCierre(turnos) ||
      "No hay texto hablado en esta sección.",
  });

  if (!output) {
    throw new Error("No se pudo preparar el cierre de la sección");
  }

  return output;
}
