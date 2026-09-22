import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSeccion } from "@/components/admin/admin-seccion";
import { AsignarEntrevistaForm } from "@/components/admin/asignar-entrevista-form";
import { CambiarRolPortalForm } from "@/components/admin/cambiar-rol-portal-form";
import { DescargarTranscripcionButton } from "@/components/admin/descargar-transcripcion-button";
import { DocumentoUploadForm } from "@/components/admin/documento-upload-form";
import { EditarStakeholderForm } from "@/components/admin/editar-stakeholder-form";
import { EntrarComoStakeholderButton } from "@/components/admin/entrar-como-stakeholder-button";
import { EntrevistaEditor } from "@/components/admin/entrevista-editor";
import { EnviarNotionTranscripcionButton } from "@/components/admin/enviar-notion-transcripcion-button";
import { InvitarEntrevistaForm } from "@/components/admin/invitar-entrevista-form";
import { MarcarFaseForm } from "@/components/admin/marcar-fase-form";
import { PreguntasEntrevistaForm } from "@/components/admin/preguntas-entrevista-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { listarEntrevistasInvitables } from "@/lib/consultoria/invitacion-entrevista";
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
  const entrevistasInvitables = await listarEntrevistasInvitables(
    proyectoId,
    id
  );

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
            {detalle.nombreCompleto}
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
          <EnviarNotionTranscripcionButton
            completada={detalle.estadoEntrevista === "completada"}
            notionPageId={detalle.notionTranscripcionId}
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

      <AdminSeccion
        descripcion="Nombre, apellido, correo y empresa. Si cambia el correo, entra al portal con el nuevo."
        titulo="Datos de la persona"
      >
        <EditarStakeholderForm
          apellido={detalle.apellido}
          email={detalle.email}
          firma={detalle.firma}
          nombre={detalle.nombre}
          proyectoId={proyectoId}
          stakeholderId={detalle.id}
        />
      </AdminSeccion>

      <AdminSeccion
        descripcion={
          detalle.rolPortal
            ? "Cambia cómo entra esta persona la próxima vez que abra el portal."
            : "Todavía no tiene cuenta. Si ya le enviaste la entrevista, elige el acceso y guarda."
        }
        resumen={etiquetaAccesoAdmin(detalle.rolPortal)}
        titulo="Acceso al portal"
      >
        <CambiarRolPortalForm
          proyectoId={proyectoId}
          rolActual={detalle.rolPortal}
          stakeholderId={detalle.id}
        />
      </AdminSeccion>

      {entrevistasInvitables.length > 0 ? (
        <AdminSeccion
          descripcion="Envía el portal: entra con su correo y un código. Si ya tiene cuenta, no se crea otra ni se cambia su rol."
          titulo="Invitar a esta entrevista"
        >
          <InvitarEntrevistaForm
            entrevistas={entrevistasInvitables}
            proyectoId={proyectoId}
            stakeholderId={detalle.id}
          />
        </AdminSeccion>
      ) : null}

      {detalle.entrevistaId ? (
        <>
          <AdminSeccion
            descripcion="Los cambios aplican a la próxima respuesta del entrevistador."
            resumen={`${detalle.secciones.length} secciones`}
            titulo="Guion de la entrevista"
          >
            <PreguntasEntrevistaForm
              entrevistaId={detalle.entrevistaId}
              proyectoId={proyectoId}
              secciones={detalle.secciones}
              stakeholderId={detalle.id}
            />
          </AdminSeccion>

          <AdminSeccion titulo="Transcripción">
            <EntrevistaEditor
              entrevistaId={detalle.entrevistaId}
              proyectoId={proyectoId}
              resumenInicial={detalle.resumen}
              stakeholderId={detalle.id}
              transcripcionInicial={detalle.transcripcion}
            />
          </AdminSeccion>
        </>
      ) : (
        <AsignarEntrevistaForm
          nombre={detalle.nombreCompleto}
          plantillas={plantillas}
          proyectoId={proyectoId}
          stakeholderId={detalle.id}
        />
      )}

      <AdminSeccion
        descripcion="Al marcar una fase como completada, el portal cliente se actualiza vía Realtime."
        titulo="Fases del proyecto"
      >
        <MarcarFaseForm
          fases={detalle.fases}
          faseVinculadaId={detalle.faseVinculadaId}
          proyectoId={proyectoId}
          stakeholderId={detalle.id}
        />
      </AdminSeccion>

      <AdminSeccion
        resumen={
          detalle.documentos.length === 1
            ? "1 documento"
            : `${detalle.documentos.length} documentos`
        }
        titulo="Documentos"
      >
        <DocumentoUploadForm
          documentos={detalle.documentos}
          faseDefaultId={detalle.faseVinculadaId}
          fases={detalle.fases}
          proyectoId={detalle.proyectoId}
          stakeholderId={detalle.id}
        />
      </AdminSeccion>
    </>
  );
}

function etiquetaAccesoAdmin(rol: string | null) {
  if (rol === "cliente") {
    return "Cliente";
  }
  if (rol === "stakeholder") {
    return "Stakeholder";
  }
  return "Sin cuenta";
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
