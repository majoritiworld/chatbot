import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { enlaceAutorizacion } from "@/lib/consultoria/google-calendar";

export async function GET(request: NextRequest) {
  const admin = await requireAdminUser();
  const proyectoId = z
    .string()
    .uuid()
    .safeParse(request.nextUrl.searchParams.get("proyecto"));

  if (!proyectoId.success) {
    redirect("/admin");
  }

  const url = enlaceAutorizacion({
    proyectoId: proyectoId.data,
    usuarioId: admin.id,
  });
  if (!url) {
    redirect(`/admin/${proyectoId.data}?calendario=config`);
  }

  redirect(url);
}
