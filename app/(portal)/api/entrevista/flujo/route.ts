import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { leerSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { avanzarFlujoEntrevista } from "@/lib/consultoria/entrevistas";

const bodySchema = z.object({
  desde: z.enum(["bienvenida", "presentacion"]),
  entrevistaId: z.guid(),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const session = await auth();
    const enlace = await leerSesionEntrevista();
    if (!(session?.user || enlace?.entrevistaId === parsed.data.entrevistaId)) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await avanzarFlujoEntrevista(parsed.data);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo continuar";
    return Response.json({ error: message }, { status: 400 });
  }
}
