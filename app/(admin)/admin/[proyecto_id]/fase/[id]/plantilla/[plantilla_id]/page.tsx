import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EnviarPlantillaForm } from "@/components/admin/enviar-plantilla-form";
import { PreguntasPlantillaForm } from "@/components/admin/preguntas-plantilla-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { getPlantillaDelProyecto } from "@/lib/consultoria/plantillas";

type PlantillaParams = Promise<{
  proyecto_id: string;
  id: string;
  plantilla_id: string;
}>;

export default function AdminPlantillaPage({
  params,
}: {
  params: PlantillaParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <Suspense fallback={<PlantillaSkeleton />}>
        <PlantillaContenido params={params} />
      </Suspense>
    </main>
  );
}

async function PlantillaContenido({ params }: { params: PlantillaParams }) {
  const {
    proyecto_id: proyectoId,
    id: faseId,
    plantilla_id: plantillaId,
  } = await params;
  await requireAdminUser();
  const plantilla = await getPlantillaDelProyecto(proyectoId, plantillaId);

  if (!plantilla || plantilla.faseId !== faseId) {
    notFound();
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link
          className="w-fit text-muted-foreground text-sm hover:underline"
          href={`/admin/${proyectoId}/fase/${faseId}`}
        >
          ← {plantilla.faseOrden}. {plantilla.faseNombre}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            {plantilla.nombre}
          </h1>
          <Badge variant="outline">
            {plantilla.enviadas === 1
              ? "1 envío"
              : `${plantilla.enviadas} envíos`}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {plantilla.secciones.length} secciones · {plantilla.preguntas.length}{" "}
          preguntas guía
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div>
          <h2 className="font-medium text-base">Guion</h2>
          <p className="text-muted-foreground text-sm">
            Los cambios aplican a los próximos envíos. Quienes ya la recibieron
            siguen con su copia.
          </p>
        </div>
        <PreguntasPlantillaForm
          plantillaId={plantilla.id}
          proyectoId={plantilla.proyectoId}
          secciones={plantilla.secciones}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div>
          <h2 className="font-medium text-base">Enviar</h2>
          <p className="text-muted-foreground text-sm">
            Crea las personas, clona esta entrevista y les manda el acceso.
            Elige si entran como cliente (portal completo) o stakeholder (solo
            su entrevista).
          </p>
        </div>
        <EnviarPlantillaForm
          plantillaId={plantilla.id}
          proyectoId={plantilla.proyectoId}
        />
      </section>
    </>
  );
}

function PlantillaSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
