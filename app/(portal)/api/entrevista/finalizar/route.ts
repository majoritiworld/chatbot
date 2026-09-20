import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { cerrarSeccionDirecta } from "@/lib/consultoria/entrevistas";

export const maxDuration = 60;

const bodySchema = z.object({
  // guid: DB ids are not always RFC-4122 versioned.
  entrevistaId: z.guid(),
  forzar: z.boolean().optional(),
  seccionId: z.guid(),
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

    const { entrevistaId, forzar = false, seccionId } = parsed.data;
    const result = await cerrarSeccionDirecta({
      entrevistaId,
      forzar,
      seccionId,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("finalizar entrevista", error);
    const message =
      error instanceof Error ? error.message : "No se pudo finalizar";
    return Response.json({ error: message }, { status: 400 });
  }
}
