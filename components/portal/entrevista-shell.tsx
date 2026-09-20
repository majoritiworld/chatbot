"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { EntrevistaMenuSecundario } from "@/components/portal/entrevista-menu-secundario";
import { cn } from "@/lib/utils";

export function EntrevistaShell({
  acciones,
  children,
  compactoMovil = false,
  correoUsuario,
  guardarMovil,
  mostrarPortal = true,
  onAbrirAyuda,
  onIrAlPortal,
  onIntentarCerrarSesion,
  progresoTema,
  seccion,
  titulo = "Entrevista",
  tituloTema,
}: {
  acciones?: ReactNode;
  children?: ReactNode;
  compactoMovil?: boolean;
  correoUsuario?: string | null;
  guardarMovil?: ReactNode;
  mostrarPortal?: boolean;
  onAbrirAyuda?: () => void;
  onIrAlPortal?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onIntentarCerrarSesion?: () => boolean;
  progresoTema?: string;
  seccion?: string;
  titulo?: ReactNode;
  tituloTema?: string;
}) {
  const menu = compactoMovil ? (
    <EntrevistaMenuSecundario
      correo={correoUsuario}
      mostrarPortal={mostrarPortal}
      onAbrirAyuda={onAbrirAyuda}
      onIntentarCerrarSesion={onIntentarCerrarSesion}
      onIrAlPortal={onIrAlPortal}
    />
  ) : null;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white text-neutral-900"
      data-entrevista-activa={compactoMovil ? "true" : undefined}
    >
      <header
        className={cn(
          "shrink-0 border-border/40 border-b bg-white",
          compactoMovil ? "md:min-h-12" : "min-h-12"
        )}
        data-testid="entrevista-cabecera"
      >
        <div
          className={cn(
            "flex-wrap items-center gap-2 px-6 py-2",
            compactoMovil ? "hidden md:flex" : "flex"
          )}
        >
          {mostrarPortal ? (
            <>
              <Link
                className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                href="/portal"
                onClick={onIrAlPortal}
              >
                <ArrowLeftIcon className="size-3" />
                Fases
              </Link>
              <span className="text-border text-xs">/</span>
            </>
          ) : null}
          <span className="text-foreground text-xs">{titulo}</span>
          {seccion ? (
            <>
              <span className="text-border text-xs">/</span>
              <span className="text-muted-foreground text-xs">{seccion}</span>
            </>
          ) : null}
          {acciones ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {acciones}
            </div>
          ) : null}
        </div>

        {compactoMovil ? (
          <div className="flex flex-col gap-0.5 px-3 py-2 md:hidden">
            <div className="flex min-h-11 items-center gap-2">
              <p className="min-w-0 flex-1 text-muted-foreground text-xs leading-4">
                {progresoTema ?? titulo}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {guardarMovil}
                {menu}
              </div>
            </div>
            {tituloTema ? (
              <h1 className="line-clamp-2 text-pretty font-medium text-sm leading-snug">
                {tituloTema}
              </h1>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
