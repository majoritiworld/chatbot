"use client";

import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function AdminSeccion({
  children,
  defaultOpen = false,
  descripcion,
  resumen,
  titulo,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  descripcion?: string;
  resumen?: string;
  titulo: string;
}) {
  return (
    <Collapsible
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
      defaultOpen={defaultOpen}
    >
      <h2 className="m-0 font-medium text-sm">
        <CollapsibleTrigger
          className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
          type="button"
        >
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
          <span className="min-w-0 flex-1">{titulo}</span>
          {resumen ? (
            <span className="shrink-0 font-normal text-muted-foreground text-xs">
              {resumen}
            </span>
          ) : null}
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="border-border border-t">
        <div className="flex flex-col gap-4 px-4 py-4">
          {descripcion ? (
            <p className="text-muted-foreground text-sm">{descripcion}</p>
          ) : null}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AdminAlta({
  children,
  etiqueta,
  etiquetaAbierta = "Cerrar",
}: {
  children: ReactNode;
  etiqueta: string;
  etiquetaAbierta?: string;
}) {
  const [open, setOpen] = useState(false);
  const onOpenChange = useCallback((siguiente: boolean) => {
    setOpen(siguiente);
  }, []);
  const textoTrigger = open ? etiquetaAbierta : etiqueta;

  return (
    <Collapsible onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          {textoTrigger}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
