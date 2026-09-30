import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { leerSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";
import {
  CorreoBloqueadoError,
  enviarCorreoAgradecimiento,
} from "@/lib/consultoria/email-entrevista";
import {
  entrevistaParaReintentoCorreo,
  enviarEntrevista,
  intentarSintesisConsulta,
  marcarCorreoAgradecimientoEnviado,
} from "@/lib/consultoria/entrevistas";
import { sincronizarTranscripcionNotion } from "@/lib/consultoria/notion-transcripcion";

const ESPERA_SINTESIS_AL_ENVIAR_MS = 15_000;
const CORREO_EN_REVISION =
  "El correo de confirmación está pendiente: el equipo del proyecto ya tiene el aviso.";

const bodySchema = z.object({
  entrevistaId: z.guid(),
  soloCorreo: z.boolean().optional(),
});

function mensajeReintento(error: unknown) {
  if (error instanceof CorreoBloqueadoError) {
    return CORREO_EN_REVISION;
  }
  return error instanceof Error
    ? error.message
    : "No se pudo reenviar el correo";
}

async function enviarNotificacion(entrevistaId: string) {
  const destino = await entrevistaParaReintentoCorreo(entrevistaId);
  if (destino.alreadyDone) {
    return { correoEnviado: true, ok: true as const };
  }

  await enviarCorreoAgradecimiento({
    emailEsperado: destino.email,
    entrevistaId,
  });
  await marcarCorreoAgradecimientoEnviado(entrevistaId);
  return { correoEnviado: true, ok: true as const };
}

async function publicarNotion(entrevistaId: string) {
  try {
    await sincronizarTranscripcionNotion(entrevistaId);
    return null;
  } catch (error) {
    console.error("No se pudo publicar la transcripción en Notion", error);
    return "La entrevista se envió, pero la transcripción no llegó a Notion.";
  }
}

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

    if (parsed.data.soloCorreo) {
      try {
        return Response.json(
          await enviarNotificacion(parsed.data.entrevistaId)
        );
      } catch (error) {
        return Response.json(
          { error: mensajeReintento(error) },
          { status: 400 }
        );
      }
    }

    const result = await enviarEntrevista(parsed.data.entrevistaId);
    if (!result.alreadyDone) {
      await intentarSintesisConsulta(
        parsed.data.entrevistaId,
        ESPERA_SINTESIS_AL_ENVIAR_MS
      );
    }
    const warningNotion = await publicarNotion(parsed.data.entrevistaId);

    if (!result.email) {
      return Response.json({
        ok: true,
        warning:
          warningNotion ??
          "La entrevista se envió, pero no encontramos un email.",
      });
    }
    if (result.correoEnviado) {
      return Response.json({
        correoEnviado: true,
        ok: true,
        ...(warningNotion ? { warning: warningNotion } : {}),
      });
    }

    try {
      await enviarCorreoAgradecimiento({
        emailEsperado: result.email,
        entrevistaId: parsed.data.entrevistaId,
      });
      await marcarCorreoAgradecimientoEnviado(parsed.data.entrevistaId);
      return Response.json({
        correoEnviado: true,
        ok: true,
        ...(warningNotion ? { warning: warningNotion } : {}),
      });
    } catch (error) {
      const pendiente =
        error instanceof CorreoBloqueadoError
          ? `La entrevista se envió. ${CORREO_EN_REVISION}`
          : "La entrevista se envió, pero el correo de confirmación sigue pendiente.";
      return Response.json({
        correoEnviado: false,
        ok: true,
        warning: warningNotion ?? pendiente,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo enviar";
    return Response.json({ error: message }, { status: 400 });
  }
}
