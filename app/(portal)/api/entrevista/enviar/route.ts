import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { enviarCorreoAgradecimiento } from "@/lib/consultoria/email-entrevista";
import {
  entrevistaParaReintentoCorreo,
  enviarEntrevista,
  marcarCorreoAgradecimientoEnviado,
} from "@/lib/consultoria/entrevistas";

const bodySchema = z.object({
  entrevistaId: z.guid(),
  soloCorreo: z.boolean().optional(),
});

async function enviarNotificacion(entrevistaId: string) {
  const destino = await entrevistaParaReintentoCorreo(entrevistaId);
  if (destino.alreadyDone) {
    return { correoEnviado: true, ok: true as const };
  }

  await enviarCorreoAgradecimiento({
    email: destino.email,
    entrevistaId,
    nombre: destino.nombre,
  });
  await marcarCorreoAgradecimientoEnviado(entrevistaId);
  return { correoEnviado: true, ok: true as const };
}

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

    if (parsed.data.soloCorreo) {
      try {
        return Response.json(
          await enviarNotificacion(parsed.data.entrevistaId)
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo reenviar el correo";
        return Response.json({ error: message }, { status: 400 });
      }
    }

    const result = await enviarEntrevista(parsed.data.entrevistaId);
    if (!result.email) {
      return Response.json({
        ok: true,
        warning: "La entrevista se envió, pero no encontramos un email.",
      });
    }
    if (result.correoEnviado) {
      return Response.json({ correoEnviado: true, ok: true });
    }

    try {
      await enviarCorreoAgradecimiento({
        email: result.email,
        entrevistaId: parsed.data.entrevistaId,
        nombre: result.nombre,
      });
      await marcarCorreoAgradecimientoEnviado(parsed.data.entrevistaId);
      return Response.json({ correoEnviado: true, ok: true });
    } catch {
      return Response.json({
        correoEnviado: false,
        ok: true,
        warning:
          "La entrevista se envió, pero el correo de confirmación sigue pendiente.",
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo enviar";
    return Response.json({ error: message }, { status: 400 });
  }
}
