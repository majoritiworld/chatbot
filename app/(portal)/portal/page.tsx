import { Suspense } from "react";
import { PortalAvisoGuardado } from "@/components/portal/portal-aviso-guardado";
import { PortalFasesRealtime } from "@/components/portal/portal-fases-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { getEventosDelProyecto } from "@/lib/consultoria/eventos";
import { getFasesDelProyecto, getProyecto } from "@/lib/consultoria/fases";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { isClienteRole, isStakeholderRole } from "@/lib/consultoria/roles";

function primerNombre(nombre: string | null) {
  if (!nombre) {
    return null;
  }

  return (
    nombre
      .trim()
      .split(" ")
      .find((parte) => parte.length > 0) ?? null
  );
}

export default function PortalPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12">
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
  const [proyecto, fases, eventos] = await Promise.all([
    getProyecto(portalUser.proyectoId),
    getFasesDelProyecto(portalUser.proyectoId),
    getEventosDelProyecto(portalUser.proyectoId),
  ]);
  const nombre = primerNombre(portalUser.nombre);
  const saludo = nombre ? `Hola, ${nombre}` : "Hola";

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{saludo}</span>
        <h1 className="font-semibold text-2xl tracking-tight">
          Bienvenid@ al Portal de {proyecto?.cliente ?? "tu compañía"}
        </h1>
      </header>

      {!portalUser.proyectoId ||
      (fases.length === 0 && eventos.length === 0) ? (
        <p className="text-muted-foreground text-sm">
          {isStakeholderRole(portalUser.rol)
            ? "Todavía no tienes una entrevista asignada. Cuando Majoriti la publique, entrarás directo a ella."
            : "Todavía no hay fases publicadas para tu proyecto."}
        </p>
      ) : (
        <PortalFasesRealtime
          eventos={eventos}
          fases={fases}
          proyectoId={portalUser.proyectoId}
          tourHabilitado={isClienteRole(portalUser.rol)}
          userId={portalUser.id}
        />
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
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {[0, 1, 2, 3].map((index) => (
            <div className="flex gap-4" key={index}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-20 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  );
}
