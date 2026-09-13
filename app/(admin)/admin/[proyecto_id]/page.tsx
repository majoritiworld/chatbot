import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FasesProyecto } from "@/components/admin/fases-proyecto";
import { PlantillasProyecto } from "@/components/admin/plantillas-proyecto";
import { StakeholdersTable } from "@/components/admin/stakeholders-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { listPlantillasAdmin } from "@/lib/consultoria/plantillas";
import {
  getProyectoAdmin,
  listFasesAdmin,
  listStakeholdersAdmin,
} from "@/lib/consultoria/stakeholders";

type ProyectoParams = Promise<{ proyecto_id: string }>;

export default function AdminProyectoPage({
  params,
}: {
  params: ProyectoParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <Suspense fallback={<ProyectoSkeleton />}>
        <ProyectoContenido params={params} />
      </Suspense>
    </main>
  );
}

async function ProyectoContenido({ params }: { params: ProyectoParams }) {
  const { proyecto_id: proyectoId } = await params;
  await requireAdminUser();
  const proyecto = await getProyectoAdmin(proyectoId);

  if (!proyecto) {
    notFound();
  }

  const [stakeholders, fases, plantillas] = await Promise.all([
    listStakeholdersAdmin(proyectoId),
    listFasesAdmin(proyectoId),
    listPlantillasAdmin(proyectoId),
  ]);
  const completadas = stakeholders.filter(
    (row) => row.estadoEntrevista === "completada"
  ).length;

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link
          className="w-fit text-muted-foreground text-sm hover:underline"
          href="/admin"
        >
          ← Clientes
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">
          {proyecto.nombre}
        </h1>
        <p className="text-muted-foreground text-sm">
          {proyecto.cliente} · {completadas}/{stakeholders.length} entrevistas
          completadas
        </p>
      </header>

      <FasesProyecto fases={fases} proyectoId={proyectoId} />

      <PlantillasProyecto
        fases={fases}
        plantillas={plantillas}
        proyectoId={proyectoId}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-base">Stakeholders</h2>
        <StakeholdersTable
          proyectoId={proyectoId}
          stakeholders={stakeholders}
        />
      </section>
    </>
  );
}

function ProyectoSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
