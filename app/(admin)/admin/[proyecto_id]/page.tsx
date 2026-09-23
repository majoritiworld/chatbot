import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminAlta, AdminSeccion } from "@/components/admin/admin-seccion";
import { AgregarStakeholderForm } from "@/components/admin/agregar-stakeholder-form";
import { EditarProyectoForm } from "@/components/admin/editar-proyecto-form";
import { EventosProyecto } from "@/components/admin/eventos-proyecto";
import { FasesProyecto } from "@/components/admin/fases-proyecto";
import { PersonasPorAcceso } from "@/components/admin/stakeholders-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { getEventosDelProyecto } from "@/lib/consultoria/eventos";
import { cargarCalendarioAdmin } from "@/lib/consultoria/google-calendar";
import { avisoCalendario } from "@/lib/consultoria/google-evento";
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

  const [stakeholders, fases, eventos, calendario, consulta] =
    await Promise.all([
      listStakeholdersAdmin(proyectoId),
      listFasesAdmin(proyectoId),
      getEventosDelProyecto(proyectoId),
      cargarCalendarioAdmin(admin.id),
      searchParams,
    ]);
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
        defaultOpen
        descripcion="Quienes entran al portal de este proyecto. Ábrelos para editar datos, invitaciones o la transcripción."
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
