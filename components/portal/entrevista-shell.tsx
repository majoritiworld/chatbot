import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chrome around the interview: a quiet breadcrumb plus a slot for secondary
 * actions, so the conversation below stays the focus of the screen.
 */
export function EntrevistaShell({
  acciones,
  aviso,
  children,
  mostrarPortal = true,
  titulo = "Entrevista",
}: {
  acciones?: ReactNode;
  aviso?: string;
  children?: ReactNode;
  mostrarPortal?: boolean;
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
            >
              <ArrowLeftIcon className="size-3" />
              Fases
            </Link>
            <span className="text-border text-xs">/</span>
          </>
        ) : null}
        <span className="text-foreground text-xs">{titulo}</span>
        {acciones ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {acciones}
          </div>
        ) : null}
      </header>
      {aviso ? (
        <p className="shrink-0 border-border/40 border-b px-6 py-2 text-muted-foreground text-xs">
          {aviso}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
