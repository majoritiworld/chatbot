import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<AccesoCargando />}>
          <AccesoProyecto params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function AccesoCargando() {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-8"
      data-acceso="cargando"
      role="status"
    >
      <p className="sr-only">Cargando</p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Skeleton className="h-[165px] w-[200px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-full min-[496px]:h-5" />
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
      <Skeleton
        aria-hidden="true"
        className="h-[62px] w-full min-[496px]:h-[42px]"
      />
    </div>
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
    <div className="flex flex-col gap-8" data-acceso="listo" style={estilo}>
      <LoginForm
        accesoDirecto={encontrada.accesoDirecto}
        enlaceInvalido={error === "auth"}
        marca={marca}
        proyectoSlug={marca.slug}
      />
    </div>
  );
}
