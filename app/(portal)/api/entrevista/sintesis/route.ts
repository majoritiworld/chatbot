import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { leerSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { guardarSintesisConsultaEntrevista } from "@/lib/consultoria/entrevistas";

const ESPERA_SINTESIS_AL_RECUPERAR_MS = 45_000;

const bodySchema = z.object({
  entrevistaId: z.guid(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const session = await auth();
  const enlace = await leerSesionEntrevista();
  if (!(session?.user || enlace?.entrevistaId === parsed.data.entrevistaId)) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    return Response.json(
      await guardarSintesisConsultaEntrevista(
        parsed.data.entrevistaId,
        AbortSignal.timeout(ESPERA_SINTESIS_AL_RECUPERAR_MS)
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "No puedes leer esta entrevista") {
      return Response.json({ error: message }, { status: 403 });
    }
    if (message === "La entrevista todavía no está enviada") {
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ estado: "pendiente" });
  }
}
