import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { CerrarSesionButton } from "@/components/auth/cerrar-sesion-button";
import { VolverAdminButton } from "@/components/auth/volver-admin-button";
import { leerVistaComo } from "@/lib/consultoria/impersonar";

export function SessionBar() {
  return (
    <Suspense
      fallback={<div className="h-10 shrink-0 border-border/40 border-b" />}
    >
      <SessionBarContent />
    </Suspense>
  );
}

async function SessionBarContent() {
  const [session, vistaComo] = await Promise.all([auth(), leerVistaComo()]);
  if (!session?.user) {
    return null;
  }

  if (vistaComo) {
    return (
      <div className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-amber-500/30 border-b bg-amber-500/10 px-3 py-1.5 sm:min-h-10 sm:px-8 sm:py-2">
        <p className="text-amber-950 text-xs dark:text-amber-100" role="status">
          Estás en el portal como {vistaComo.nombre} ({vistaComo.email}). Lo que
          guardes queda a su nombre.
        </p>
        <div className="flex items-center gap-2">
          <VolverAdminButton />
          <CerrarSesionButton
            className="text-muted-foreground/70 text-xs"
            size="xs"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-10 shrink-0 items-center justify-end gap-2 border-border/40 border-b px-6 sm:px-8"
      data-session-bar-cuenta=""
    >
      {session.user.email ? (
        <span className="truncate text-muted-foreground/70 text-xs">
          {session.user.email}
        </span>
      ) : null}
      <CerrarSesionButton
        className="text-muted-foreground/70 text-xs"
        size="xs"
      />
    </div>
  );
}
