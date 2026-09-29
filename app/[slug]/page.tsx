import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { decidirEntradaProyecto } from "@/lib/consultoria/acceso-proyecto";
import {
  marcaPorSlug,
  membresiasDeEmail,
} from "@/lib/consultoria/marca-publica";
import { landingPathForCurrentUser } from "@/lib/consultoria/portal";
import { createClient } from "@/lib/supabase/server";

type SlugParams = Promise<{ slug: string }>;
type SlugSearch = Promise<{ error?: string }>;

export default function AccesoProyectoPage({
  params,
  searchParams,
}: {
  params: SlugParams;
  searchParams: SlugSearch;
}) {
  return (
    <Suspense fallback={<LoginForm />}>
      <AccesoProyecto params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AccesoProyecto({
  params,
  searchParams,
}: {
  params: SlugParams;
  searchParams: SlugSearch;
}) {
  const { slug } = await params;
  const encontrada = await marcaPorSlug(slug);
  if (!encontrada) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const sesionEmail = data.user?.email;
  if (sesionEmail) {
    const decision = decidirEntradaProyecto({
      email: sesionEmail,
      membresias: await membresiasDeEmail(sesionEmail),
      proyectoId: encontrada.proyectoId,
      sesionEmail,
    });
    if (decision === "permitido") {
      redirect(await landingPathForCurrentUser(null, encontrada.proyectoId));
    }
  }

  const { error } = await searchParams;
  const { marca } = encontrada;
  const estilo: CSSProperties | undefined =
    marca.color && marca.colorTexto
      ? ({
          "--primary": marca.color,
          "--primary-foreground": marca.colorTexto,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12"
      style={estilo}
    >
      <div className="flex w-full max-w-md flex-col gap-8">
        <LoginForm
          enlaceInvalido={error === "auth"}
          marca={marca}
          proyectoSlug={marca.slug}
        />
      </div>
    </div>
  );
}
