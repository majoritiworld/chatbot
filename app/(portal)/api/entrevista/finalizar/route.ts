import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { cierreSeccionInputSchema } from "@/lib/consultoria/cierre-seccion";
import {
  completarSeccionEntrevista,
  resolveEntrevista,
} from "@/lib/consultoria/entrevistas";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 30;

const bodySchema = z.object({
  // guid: DB ids are not always RFC-4122 versioned.
  entrevistaId: z.guid(),
  hallazgos: cierreSeccionInputSchema.shape.hallazgos.optional(),
  messages: z.array(z.any()).optional(),
  respuestas: cierreSeccionInputSchema.shape.respuestas.optional(),
  seccionId: z.guid(),
  sintesis: cierreSeccionInputSchema.shape.sintesis.optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const {
      entrevistaId,
      hallazgos,
      messages,
      respuestas,
      seccionId,
      sintesis,
    } = parsed.data;
    const entrevista = await resolveEntrevista(entrevistaId);
    const seccion = entrevista?.secciones.find((item) => item.id === seccionId);
    if (!seccion) {
      return Response.json(
        { error: "Esta sección ya no está activa" },
        { status: 400 }
      );
    }
    const turnos = mensajesATurnos(
      (messages ?? []) as ChatMessage[],
      seccionId
    );
    const cierre = cierreSeccionInputSchema.safeParse({
      hallazgos,
      respuestas,
      sintesis,
    });
    const resumen = cierre.success
      ? { ...cierre.data, modo: "agente" as const }
      : {
          hallazgos: [],
          modo: "manual" as const,
          respuestas: seccion.preguntas.map((pregunta) => ({
            pregunta,
            respuesta_texto: "Ver transcripción completa.",
          })),
          sintesis: "Sección finalizada manualmente. Revisar la transcripción.",
        };

    const result = await completarSeccionEntrevista({
      entrevistaId,
      seccionId,
      turnos,
      ...resumen,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("finalizar entrevista", error);
    const message =
      error instanceof Error ? error.message : "No se pudo finalizar";
    return Response.json({ error: message }, { status: 400 });
  }
}
