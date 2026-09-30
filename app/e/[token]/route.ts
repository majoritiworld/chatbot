import { NextResponse } from "next/server";
import { entrarConEnlace } from "@/lib/consultoria/acceso-entrevista";

function redirigir(destino: string, request: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const respuesta = NextResponse.redirect(
    new URL(`${base}${destino}`, request.url),
    303
  );
  // The token is in this URL; keep it out of Referer headers, caches and indexes.
  respuesta.headers.set("Cache-Control", "no-store");
  respuesta.headers.set("Referrer-Policy", "no-referrer");
  respuesta.headers.set("X-Robots-Tag", "noindex, nofollow");
  return respuesta;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resultado = await entrarConEnlace(token);
  if (resultado.ok) {
    return redirigir(`/portal/entrevista/${resultado.entrevistaId}`, request);
  }
  const consulta = new URLSearchParams();
  if (resultado.slug) {
    consulta.set("p", resultado.slug);
  }
  if (resultado.motivo === "sesion_ajena") {
    consulta.set("motivo", "sesion");
  }
  const sufijo = consulta.size > 0 ? `?${consulta.toString()}` : "";
  return redirigir(`/e/no-disponible${sufijo}`, request);
}
