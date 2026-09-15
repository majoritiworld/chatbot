import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { avanzarFlujoEntrevista } from "@/lib/consultoria/entrevistas";

const bodySchema = z.object({
  desde: z.enum(["bienvenida", "presentacion"]),
  entrevistaId: z.guid(),
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

    const result = await avanzarFlujoEntrevista(parsed.data);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo continuar";
    return Response.json({ error: message }, { status: 400 });
  }
}
