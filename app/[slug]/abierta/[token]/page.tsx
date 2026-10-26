import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import { FormularioEnlaceAbierto } from "@/components/auth/formulario-enlace-abierto";
import { Skeleton } from "@/components/ui/skeleton";
import { faseDeEnlaceAbierto } from "@/lib/consultoria/enlace-abierto";
import { marcaPorSlug } from "@/lib/consultoria/marca-publica";

type Params = Promise<{ slug: string; token: string }>;

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
};

export default function EnlaceAbiertoPage({ params }: { params: Params }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<EnlaceAbiertoCargando />}>
          <EnlaceAbierto params={params} />
        </Suspense>
      </div>
    </div>
  );
}

function EnlaceAbiertoCargando() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8" role="status">
      <p className="sr-only">Cargando</p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Skeleton className="h-[165px] w-[200px]" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

async function EnlaceAbierto({ params }: { params: Params }) {
  const { slug, token } = await params;
  const [encontrada, fase] = await Promise.all([
    marcaPorSlug(slug),
    faseDeEnlaceAbierto(slug, token),
  ]);
  const proyectoSlug = encontrada?.marca.slug;
  if (!(encontrada && proyectoSlug && fase)) {
    notFound();
  }

  const { marca } = encontrada;
  const estilo: CSSProperties | undefined =
    marca.color && marca.colorTexto
      ? ({
          "--primary": marca.color,
          "--primary-foreground": marca.colorTexto,
        } as CSSProperties)
      : undefined;

  return (
    <div className="flex flex-col gap-8" style={estilo}>
      <FormularioEnlaceAbierto
        enlace={token}
        marca={marca}
        proyectoSlug={proyectoSlug}
      />
    </div>
  );
}
