import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { leerSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { iniciarEntrevistaEnChat } from "@/lib/consultoria/entrevistas";

const bodySchema = z.object({
  entrevistaId: z.guid(),
  texto: z.string().trim().min(1).max(2000),
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

    const result = await iniciarEntrevistaEnChat(parsed.data);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo empezar";
    return Response.json({ error: message }, { status: 400 });
  }
}
