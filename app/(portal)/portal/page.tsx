import { Suspense } from "react";
import { PortalAvisoGuardado } from "@/components/portal/portal-aviso-guardado";
import { PortalFasesRealtime } from "@/components/portal/portal-fases-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { getFasesDelProyecto, getProyecto } from "@/lib/consultoria/fases";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { isStakeholderRole } from "@/lib/consultoria/roles";

export default function PortalPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-12">
      <Suspense fallback={null}>
        <PortalAvisoGuardado />
      </Suspense>
      <Suspense fallback={<PortalSkeleton />}>
        <PortalContenido />
      </Suspense>
    </main>
  );
}

async function PortalContenido() {
  const portalUser = await requirePortalUser();
  const [proyecto, fases] = await Promise.all([
    getProyecto(portalUser.proyectoId),
    getFasesDelProyecto(portalUser.proyectoId),
  ]);

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">
          {proyecto?.cliente ?? "Portal de consultoría"}
        </span>
        <h1 className="font-semibold text-2xl tracking-tight">
          {proyecto?.nombre ?? "Tu proyecto"}
        </h1>
      </header>

      {fases.length === 0 || !portalUser.proyectoId ? (
        <p className="text-muted-foreground text-sm">
          {isStakeholderRole(portalUser.rol)
            ? "Todavía no tienes una entrevista asignada. Cuando Majoriti la publique, entrarás directo a ella."
            : "Todavía no hay fases publicadas para tu proyecto."}
        </p>
      ) : (
        <PortalFasesRealtime fases={fases} proyectoId={portalUser.proyectoId} />
      )}
    </>
  );
}

function PortalSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72" />
      </div>
      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3].map((index) => (
          <div className="flex gap-4" key={index}>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-20 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    </>
  );
}
