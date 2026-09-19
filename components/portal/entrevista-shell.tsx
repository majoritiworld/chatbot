import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

export function EntrevistaShell({
  acciones,
  children,
  mostrarPortal = true,
  onIrAlPortal,
  seccion,
  titulo = "Entrevista",
}: {
  acciones?: ReactNode;
  children?: ReactNode;
  mostrarPortal?: boolean;
  onIrAlPortal?: (event: MouseEvent<HTMLAnchorElement>) => void;
  seccion?: string;
  titulo?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-border/40 border-b px-6 py-2">
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
