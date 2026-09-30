import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CerrarSesionButton } from "@/components/auth/cerrar-sesion-button";
import { Button } from "@/components/ui/button";
import { slugValido } from "@/lib/consultoria/marca";
import { MENSAJE_CUENTA_NO_PUEDE_RESPONDER } from "@/lib/consultoria/mensajes-chat";
import {
  MENSAJE_ENLACE_INVALIDO,
  MENSAJE_SESION_AJENA,
} from "@/lib/consultoria/sesion-entrevista";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Enlace no disponible",
};

type Busqueda = Promise<{ motivo?: string; p?: string }>;

export default function EnlaceNoDisponiblePage({
  searchParams,
}: {
  searchParams: Busqueda;
}) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Suspense fallback={<Aviso motivo={null} slug={null} />}>
        <AvisoDelEnlace searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AvisoDelEnlace({ searchParams }: { searchParams: Busqueda }) {
  const { motivo, p } = await searchParams;
  return (
    <Aviso
      motivo={motivo === "sesion" || motivo === "cuenta" ? motivo : null}
      slug={slugValido(p ?? null)}
    />
  );
}

function Aviso({
  motivo,
  slug,
}: {
  motivo: "cuenta" | "sesion" | null;
  slug: string | null;
}) {
  const sesionAjena = motivo === "sesion" || motivo === "cuenta";
  let texto = MENSAJE_ENLACE_INVALIDO;
  let titulo = "Enlace no disponible";
  if (motivo === "cuenta") {
    texto = MENSAJE_CUENTA_NO_PUEDE_RESPONDER;
    titulo = "Esta cuenta no puede responder";
  } else if (motivo === "sesion") {
    texto = MENSAJE_SESION_AJENA;
    titulo = "Hay otra sesión abierta";
  }
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-semibold text-xl tracking-tight">{titulo}</h1>
        <p className="max-w-md text-muted-foreground text-sm">{texto}</p>
      </div>
      {sesionAjena ? (
        <CerrarSesionButton variant="outline" />
      ) : (
        <Button asChild variant="outline">
          <Link href={slug ? `/${slug}?codigo=1` : "/login"}>
            Entrar con correo y código
          </Link>
        </Button>
      )}
    </>
  );
}
