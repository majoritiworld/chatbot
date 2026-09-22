import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const estadoSchema = z.object({
  e: z.number().int(),
  p: z.string().uuid(),
  u: z.string().uuid(),
});

function firmar(payload: string, secreto: string) {
  return createHmac("sha256", secreto).update(payload).digest("base64url");
}

export function empaquetarEstadoOAuth(
  datos: { expira: number; proyectoId: string; usuarioId: string },
  secreto: string
) {
  const payload = Buffer.from(
    JSON.stringify({
      e: datos.expira,
      p: datos.proyectoId,
      u: datos.usuarioId,
    }),
    "utf8"
  ).toString("base64url");
  return `${firmar(payload, secreto)}.${payload}`;
}

export function leerEstadoOAuth(
  token: string,
  secreto: string,
  ahora = Date.now()
) {
  const punto = token.indexOf(".");
  if (punto <= 0) {
    return null;
  }

  const firma = token.slice(0, punto);
  const payload = token.slice(punto + 1);
  const esperada = firmar(payload, secreto);
  const recibida = Buffer.from(firma);
  const calculada = Buffer.from(esperada);
  if (
    recibida.length !== calculada.length ||
    !timingSafeEqual(recibida, calculada)
  ) {
    return null;
  }

  try {
    const parsed = estadoSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    );
    if (!parsed.success || parsed.data.e < ahora) {
      return null;
    }
    return { proyectoId: parsed.data.p, usuarioId: parsed.data.u };
  } catch {
    return null;
  }
}
