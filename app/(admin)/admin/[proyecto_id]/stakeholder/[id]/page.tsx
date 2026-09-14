import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AsignarEntrevistaForm } from "@/components/admin/asignar-entrevista-form";
import { CambiarRolPortalForm } from "@/components/admin/cambiar-rol-portal-form";
import { DescargarTranscripcionButton } from "@/components/admin/descargar-transcripcion-button";
import { DocumentoUploadForm } from "@/components/admin/documento-upload-form";
import { EntrarComoStakeholderButton } from "@/components/admin/entrar-como-stakeholder-button";
import { EntrevistaEditor } from "@/components/admin/entrevista-editor";
import { MarcarFaseForm } from "@/components/admin/marcar-fase-form";
import { PreguntasEntrevistaForm } from "@/components/admin/preguntas-entrevista-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { listPlantillasAdmin } from "@/lib/consultoria/plantillas";
import { getStakeholderDetalle } from "@/lib/consultoria/stakeholders";

type DetalleParams = Promise<{ proyecto_id: string; id: string }>;

export default function AdminStakeholderPage({
  params,
}: {
  params: DetalleParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <Suspense fallback={<DetalleSkeleton />}>
        <DetalleContenido params={params} />
      </Suspense>
    </main>
  );
}

async function DetalleContenido({ params }: { params: DetalleParams }) {
  const { proyecto_id: proyectoId, id } = await params;
  await requireAdminUser();
  const detalle = await getStakeholderDetalle(id);

  // A stakeholder reached through another project's URL is a wrong URL, not a
  // different view of the same record.
  if (!detalle || detalle.proyectoId !== proyectoId) {
    notFound();
  }

  const plantillas = detalle.entrevistaId
    ? []
    : await listPlantillasAdmin(proyectoId);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          className="w-fit text-muted-foreground text-sm hover:underline"
          href={`/admin/${proyectoId}`}
        >
          ← {detalle.proyectoNombre}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            {detalle.nombre}
          </h1>
          <Badge variant="outline">{detalle.estadoEntrevista}</Badge>
          {detalle.rolPortal ? (
            <Badge
              variant={
                detalle.rolPortal === "cliente" ? "default" : "secondary"
              }
            >
              {detalle.rolPortal === "cliente" ? "Cliente" : "Stakeholder"}
            </Badge>
          ) : null}
          <DescargarTranscripcionButton
            className="ml-auto"
            completada={detalle.estadoEntrevista === "completada"}
            stakeholderId={detalle.id}
          />
          <EntrarComoStakeholderButton stakeholderId={detalle.id} />
        </div>
        <p className="text-muted-foreground text-sm">
          {[detalle.firma, detalle.email, detalle.proyectoNombre]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <CambiarRolPortalForm
        proyectoId={proyectoId}
        rolActual={detalle.rolPortal}
        stakeholderId={detalle.id}
      />

      {detalle.entrevistaId ? (
        <>
          <PreguntasEntrevistaForm
            entrevistaId={detalle.entrevistaId}
            preguntas={detalle.preguntas}
            proyectoId={proyectoId}
            stakeholderId={detalle.id}
          />

          <EntrevistaEditor
            entrevistaId={detalle.entrevistaId}
            proyectoId={proyectoId}
            resumenInicial={detalle.resumen}
            stakeholderId={detalle.id}
            transcripcionInicial={detalle.transcripcion}
          />
        </>
      ) : (
        <AsignarEntrevistaForm
          nombre={detalle.nombre}
          plantillas={plantillas}
          proyectoId={proyectoId}
          stakeholderId={detalle.id}
        />
      )}

      <MarcarFaseForm
        fases={detalle.fases}
        faseVinculadaId={detalle.faseVinculadaId}
        proyectoId={proyectoId}
        stakeholderId={detalle.id}
      />

      <DocumentoUploadForm
        documentos={detalle.documentos}
        faseDefaultId={detalle.faseVinculadaId}
        fases={detalle.fases}
        proyectoId={detalle.proyectoId}
        stakeholderId={detalle.id}
      />
    </>
  );
}

function DetalleSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
