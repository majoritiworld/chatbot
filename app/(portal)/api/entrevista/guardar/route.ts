import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { guardarProgresoEntrevista } from "@/lib/consultoria/entrevistas";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 30;

const bodySchema = z.object({
  // guid: DB ids are not always RFC-4122 versioned.
  entrevistaId: z.guid(),
  messages: z.array(z.any()).optional(),
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

    const { entrevistaId, messages } = parsed.data;
    const turnos = mensajesATurnos((messages ?? []) as ChatMessage[]);

    const result = await guardarProgresoEntrevista({ entrevistaId, turnos });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("guardar entrevista", error);
    const message =
      error instanceof Error ? error.message : "No se pudo guardar";
    return Response.json({ error: message }, { status: 400 });
  }
}
