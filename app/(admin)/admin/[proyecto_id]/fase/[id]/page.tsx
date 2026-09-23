import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSeccion } from "@/components/admin/admin-seccion";
import { EditarFaseForm } from "@/components/admin/editar-fase-form";
import { EntrevistasFase } from "@/components/admin/entrevistas-fase";
import { PlantillasProyecto } from "@/components/admin/plantillas-proyecto";
import { TareasFase } from "@/components/admin/tareas-fase";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { esProyectoComplianceLatam } from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import {
  asegurarPlantillaGuionClFase1,
  listPlantillasAdmin,
} from "@/lib/consultoria/plantillas";
import {
  getFaseAdmin,
  getProyectoAdmin,
  listEntrevistasDeFaseAdmin,
  listStakeholdersAdmin,
} from "@/lib/consultoria/stakeholders";
import { listTareasDeFaseAdmin } from "@/lib/consultoria/tareas";

type FaseParams = Promise<{ proyecto_id: string; id: string }>;

export default function AdminFasePage({ params }: { params: FaseParams }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <Suspense fallback={<FaseSkeleton />}>
        <FaseContenido params={params} />
      </Suspense>
    </main>
  );
}

async function FaseContenido({ params }: { params: FaseParams }) {
  const { proyecto_id: proyectoId, id: faseId } = await params;
  await requireAdminUser();
  const [proyecto, fase] = await Promise.all([
    getProyectoAdmin(proyectoId),
    getFaseAdmin(proyectoId, faseId),
  ]);

  if (!(proyecto && fase)) {
    notFound();
  }

  if (fase.orden === 1 && esProyectoComplianceLatam(proyecto)) {
    await asegurarPlantillaGuionClFase1({
      faseId: fase.id,
      proyectoId,
    });
  }

  const [plantillas, entrevistas, tareas, stakeholders] = await Promise.all([
    listPlantillasAdmin(proyectoId, faseId),
    listEntrevistasDeFaseAdmin(faseId),
    listTareasDeFaseAdmin(faseId),
    listStakeholdersAdmin(proyectoId),
  ]);
  const personas = stakeholders.map((persona) => ({
    apellido: persona.apellido,
    id: persona.id,
    nombre: persona.nombre,
    nombreCompleto: persona.nombreCompleto,
  }));

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link
          className="w-fit text-muted-foreground text-sm hover:underline"
          href={`/admin/${proyectoId}`}
        >
          ← {proyecto.nombre}
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">
          {fase.orden}. {fase.nombre}
        </h1>
        <p className="text-muted-foreground text-sm">{proyecto.cliente}</p>
      </header>

      <AdminSeccion
        descripcion="Título, descripción y fechas que ve el cliente en el portal."
        titulo="Datos de la fase"
      >
        <EditarFaseForm fase={fase} proyectoId={proyectoId} />
      </AdminSeccion>

      <AdminSeccion
        defaultOpen={entrevistas.length > 0}
        descripcion="Personas que ya tienen esta entrevista. Ábrela para ver la transcripción. Quitar un envío no borra a la persona."
        resumen={
          entrevistas.length === 1 ? "1 envío" : `${entrevistas.length} envíos`
        }
        titulo="Entrevistas enviadas"
      >
        <EntrevistasFase
          entrevistas={entrevistas}
          faseId={fase.id}
          proyectoId={proyectoId}
        />
      </AdminSeccion>

      <AdminSeccion
        defaultOpen={tareas.length > 0}
        descripcion="Checklist que el cliente ve en esta fase, con la persona a cargo."
        resumen={tareas.length === 1 ? "1 tarea" : `${tareas.length} tareas`}
        titulo="Tareas"
      >
        <TareasFase
          faseId={fase.id}
          personas={personas}
          proyectoId={proyectoId}
          tareas={tareas}
        />
      </AdminSeccion>

      <PlantillasProyecto
        faseId={fase.id}
        fases={[fase]}
        personas={stakeholders}
        plantillas={plantillas}
        proyectoId={proyectoId}
      />
    </>
  );
}

function FaseSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
