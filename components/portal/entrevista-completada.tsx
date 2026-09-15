"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EntrevistaCompletada({
  correoPendiente = false,
  mostrarPortal = true,
  onReintentarCorreo,
  pending = false,
}: {
  correoPendiente?: boolean;
  mostrarPortal?: boolean;
  onReintentarCorreo?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-6" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">
          Gracias por participar
        </h1>
        <p className="text-balance text-muted-foreground text-sm">
          Tu entrevista fue enviada correctamente.
        </p>
      </div>
      {correoPendiente && onReintentarCorreo ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-balance text-amber-700 text-sm dark:text-amber-300">
            El correo de confirmación sigue pendiente.
          </p>
          <Button
            disabled={pending}
            onClick={onReintentarCorreo}
            type="button"
            variant="outline"
          >
            {pending ? "Reintentando…" : "Reintentar correo"}
          </Button>
        </div>
      ) : (
        <p className="text-balance text-muted-foreground text-sm">
          También recibirás un correo de confirmación.
        </p>
      )}
      {mostrarPortal ? (
        <Button asChild variant="outline">
          <Link href="/portal">Volver a las fases</Link>
        </Button>
      ) : null}
    </div>
  );
}
