import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccesoDirectoForm } from "@/components/admin/acceso-directo-form";
import { AdminAlta, AdminSeccion } from "@/components/admin/admin-seccion";
import { AgregarStakeholderForm } from "@/components/admin/agregar-stakeholder-form";
import { CopiarEnlaceProyecto } from "@/components/admin/copiar-enlace-proyecto";
import { EditarProyectoForm } from "@/components/admin/editar-proyecto-form";
import { EventosProyecto } from "@/components/admin/eventos-proyecto";
import { FasesProyecto } from "@/components/admin/fases-proyecto";
import { IncidenciasCorreo } from "@/components/admin/incidencias-correo";
import { MarcaProyectoForm } from "@/components/admin/marca-proyecto-form";
import { PersonasPorAcceso } from "@/components/admin/stakeholders-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { siteUrl } from "@/lib/consultoria/auth";
import { textosInvitacionDeProyecto } from "@/lib/consultoria/correos/asignacion-servidor";
import { listarIncidenciasCorreo } from "@/lib/consultoria/correos/incidencia";
import { getEventosDelProyecto } from "@/lib/consultoria/eventos";
import { cargarCalendarioAdmin } from "@/lib/consultoria/google-calendar";
import { avisoCalendario } from "@/lib/consultoria/google-evento";
import { enlaceDeProyecto, slugValido } from "@/lib/consultoria/marca";
import {
  getProyectoAdmin,
  listFasesAdmin,
  listStakeholdersAdmin,
} from "@/lib/consultoria/stakeholders";

type ProyectoParams = Promise<{ proyecto_id: string }>;
type ProyectoSearch = Promise<{ calendario?: string }>;

export default function AdminProyectoPage({
  params,
  searchParams,
}: {
  params: ProyectoParams;
  searchParams: ProyectoSearch;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <Suspense fallback={<ProyectoSkeleton />}>
        <ProyectoContenido params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProyectoContenido({
  params,
  searchParams,
}: {
  params: ProyectoParams;
  searchParams: ProyectoSearch;
}) {
  const { proyecto_id: proyectoId } = await params;
  const admin = await requireAdminUser();
  const proyecto = await getProyectoAdmin(proyectoId);

  if (!proyecto) {
    notFound();
  }

  const [
    stakeholders,
    fases,
    eventos,
    calendario,
    consulta,
    invitacion,
    incidencias,
  ] = await Promise.all([
    listStakeholdersAdmin(proyectoId),
    listFasesAdmin(proyectoId),
    getEventosDelProyecto(proyectoId),
    cargarCalendarioAdmin(admin.id),
    searchParams,
    textosInvitacionDeProyecto(proyectoId),
    listarIncidenciasCorreo(proyectoId),
  ]);
  const slug = slugValido(proyecto.slug);
  const completadas = stakeholders.filter(
    (row) => row.estadoEntrevista === "completada"
  ).length;
  const idsEnPortal = new Set(
    eventos.flatMap((evento) =>
      evento.googleEventId ? [evento.googleEventId] : []
    )
  );

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

      <AdminSeccion
        defaultOpen={!proyecto.descripcion}
        descripcion="El cliente la ve debajo del título en el portal."
        titulo="Descripción"
      >
        <EditarProyectoForm
          descripcion={proyecto.descripcion}
          proyectoId={proyectoId}
        />
      </AdminSeccion>

      <FasesProyecto fases={fases} proyectoId={proyectoId} />

      <EventosProyecto
        avisoCalendario={
          avisoCalendario(consulta.calendario) ?? calendario.aviso
        }
        calendarioConectado={calendario.conectado}
        calendarioConfigurado={calendario.configurado}
        calendarioEmail={calendario.email}
        eventos={eventos}
        proyectoId={proyectoId}
        reuniones={calendario.eventos.map((evento) => ({
          ...evento,
          enPortal: idsEnPortal.has(evento.id),
        }))}
      />

      <AdminSeccion
        descripcion="El enlace público muestra esta identidad. Quien no esté autorizado en el proyecto no entra."
        resumen={slug ? `/${slug}` : "Sin enlace"}
        titulo="Marca del proyecto"
      >
        <div className="flex flex-col gap-4">
          <CopiarEnlaceProyecto
            enlace={slug ? enlaceDeProyecto(siteUrl(), slug) : null}
          />
          <Link
            className="w-fit text-sm underline-offset-4 hover:underline"
            href={`/admin/correos?proyecto=${proyectoId}`}
          >
            Ver vista previa de los correos
          </Link>
          <MarcaProyectoForm
            avisoRespuestas={proyecto.aviso_respuestas}
            color={proyecto.color_principal}
            contactoEmail={proyecto.contacto_email}
            contactoNombre={proyecto.contacto_nombre}
            correoAsunto={proyecto.correo_asunto}
            correoCuerpo={proyecto.correo_cuerpo}
            correoFirma={proyecto.correo_firma}
            correoRemitente={proyecto.correo_remitente}
            invitacion={invitacion}
            nombrePublico={proyecto.nombre_publico}
            proyectoId={proyectoId}
            slug={proyecto.slug}
            textoBienvenida={proyecto.texto_bienvenida}
            titulo={proyecto.titulo_iniciativa}
          />
        </div>
      </AdminSeccion>

      {incidencias && incidencias.length > 0 ? (
        <IncidenciasCorreo incidencias={incidencias} />
      ) : null}

      <AdminSeccion
        descripcion="Quien conozca un correo invitado de este proyecto entra sin código. Si lo desactivas, vuelve el código de 8 dígitos."
        resumen={proyecto.acceso_directo ? "Solo con el correo" : "Con código"}
        titulo="Entrada al portal"
      >
        <AccesoDirectoForm
          accesoDirecto={proyecto.acceso_directo}
          proyectoId={proyectoId}
        />
      </AdminSeccion>

      <AdminSeccion
        defaultOpen
        descripcion="Quienes entran al portal de este proyecto. Ábrelos para editar datos o la transcripción. El cliente comparte el enlace; esta plataforma no envía la invitación."
        resumen={
          stakeholders.length === 1
            ? "1 persona"
            : `${stakeholders.length} personas`
        }
        titulo="Personas"
      >
        <PersonasPorAcceso
          proyectoId={proyectoId}
          stakeholders={stakeholders}
        />
        <AdminAlta etiqueta="Agregar persona">
          <AgregarStakeholderForm proyectoId={proyectoId} />
        </AdminAlta>
      </AdminSeccion>
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
