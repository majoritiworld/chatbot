"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useCallback } from "react";
import { signOutAction } from "@/app/(auth)/sign-out-action";
import { TerminarTemaAntesButton } from "@/components/portal/terminar-tema-antes-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const DESTINO_CERRAR_SESION = "cerrar-sesion:";

export function EntrevistaMenuSecundario({
  correo,
  mostrarPortal,
  onAbrirAyuda,
  onIrAlPortal,
  onIntentarCerrarSesion,
}: {
  correo?: string | null;
  mostrarPortal?: boolean;
  onAbrirAyuda?: () => void;
  onIrAlPortal?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onIntentarCerrarSesion?: () => boolean;
}) {
  const handleCerrarSesion = useCallback(() => {
    if (onIntentarCerrarSesion?.()) {
      return;
    }
    const form = document.getElementById("entrevista-cerrar-sesion");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, [onIntentarCerrarSesion]);

  return (
    <>
      <form
        action={signOutAction}
        className="hidden"
        id="entrevista-cerrar-sesion"
      >
        <button type="submit">Cerrar sesión</button>
      </form>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-haspopup="menu"
            aria-label="Más opciones"
            className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <EllipsisIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 max-w-[calc(100vw-1.5rem)]"
        >
          {onAbrirAyuda ? (
            <DropdownMenuItem onSelect={onAbrirAyuda}>
              Cómo funciona
            </DropdownMenuItem>
          ) : null}
          <TerminarTemaAntesButton trigger="menu" />
          {correo ? (
            <>
              {onAbrirAyuda ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="font-normal text-foreground">
                Cuenta
              </DropdownMenuLabel>
              <p className="break-all px-3 pb-2 text-muted-foreground text-xs leading-snug">
                {correo}
              </p>
            </>
          ) : null}
          <DropdownMenuItem onSelect={handleCerrarSesion}>
            Cerrar sesión
          </DropdownMenuItem>
          {mostrarPortal ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/portal" onClick={onIrAlPortal}>
                  Volver al portal
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function enviarCierreSesionPendiente() {
  const form = document.getElementById("entrevista-cerrar-sesion");
  if (form instanceof HTMLFormElement) {
    form.requestSubmit();
    return true;
  }
  return false;
}
