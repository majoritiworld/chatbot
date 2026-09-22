import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { guardarCodigoGoogle } from "@/lib/consultoria/google-calendar";
import { leerEstadoOAuth } from "@/lib/consultoria/oauth-estado";

function destino(proyectoId: string | null, codigo: string) {
  if (!proyectoId) {
    return `/admin?calendario=${codigo}`;
  }
  return `/admin/${proyectoId}?calendario=${codigo}`;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminUser();
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const sesion = leerEstadoOAuth(state, process.env.AUTH_SECRET ?? "");
  const proyectoId = sesion?.usuarioId === admin.id ? sesion.proyectoId : null;

  if (request.nextUrl.searchParams.get("error")) {
    redirect(destino(proyectoId, "denegado"));
  }

  if (!proyectoId) {
    redirect(destino(null, "estado"));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    redirect(destino(proyectoId, "estado"));
  }

  const guardado = await guardarCodigoGoogle({
    code,
    usuarioId: admin.id,
  });
  if (!guardado.ok) {
    redirect(destino(proyectoId, guardado.codigo));
  }

  redirect(destino(proyectoId, "ok"));
}
