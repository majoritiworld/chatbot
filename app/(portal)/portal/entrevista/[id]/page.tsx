import Link from "next/link";
import { Suspense } from "react";
import { EntrevistaEnCurso } from "@/components/portal/entrevista-en-curso";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { turnosDeSeccion } from "@/lib/consultoria/entrevista-contenido";
import {
  getOwnStakeholderId,
  getTranscripcionEntrevista,
  resolveEntrevista,
} from "@/lib/consultoria/entrevistas";
import { turnosAMensajes } from "@/lib/consultoria/mensajes-a-turnos";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { isClienteRole } from "@/lib/consultoria/roles";

export default function EntrevistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EntrevistaSkeleton />}>
      <EntrevistaContenido id={params.then((routeParams) => routeParams.id)} />
    </Suspense>
  );
}

async function EntrevistaContenido({ id }: { id: Promise<string> }) {
  const entrevistaId = await id;
  const portalUser = await requirePortalUser();
  const mostrarPortal = isClienteRole(portalUser.rol);
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal}>
        <Aviso
          mensaje="Esta entrevista no existe o no te corresponde."
          mostrarPortal={mostrarPortal}
        />
      </EntrevistaShell>
    );
  }

  const ownStakeholderId = await getOwnStakeholderId(portalUser.email);
  const esPropia =
    ownStakeholderId !== null && entrevista.stakeholder_id === ownStakeholderId;

  if (!esPropia) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal}>
        <Aviso
          mensaje={
            mostrarPortal
              ? "El progreso de esta entrevista se ve en el listado de fases. Solo quien fue invitado puede responderla."
              : "Esta entrevista pertenece a otro participante. Solo puedes responder la tuya."
          }
          mostrarPortal={mostrarPortal}
        />
      </EntrevistaShell>
    );
  }

  const turnos = await getTranscripcionEntrevista(entrevista.id);
  const seccionActiva = entrevista.secciones.at(entrevista.seccion_actual);
  const turnosActivos = seccionActiva
    ? turnosDeSeccion(turnos, seccionActiva.id, entrevista.seccion_actual === 0)
    : [];

  return (
    <EntrevistaEnCurso
      consentimientoEn={entrevista.consentimiento_en}
      correoAgradecimientoEn={entrevista.correo_agradecimiento_en}
      entrevistaId={entrevista.id}
      estadoInicial={entrevista.estado}
      flujoEstadoInicial={entrevista.flujo_estado}
      mensajesIniciales={turnosAMensajes(turnosActivos)}
      mostrarPortal={mostrarPortal}
      seccionActualInicial={entrevista.seccion_actual}
      secciones={entrevista.secciones}
      stakeholderNombre={entrevista.stakeholder_nombre}
    />
  );
}

function Aviso({
  mensaje,
  mostrarPortal,
}: {
  mensaje: string;
  mostrarPortal: boolean;
}) {
  return (
    <EntrevistaPantallaTransicion>
      <p className="text-muted-foreground text-sm">{mensaje}</p>
      {mostrarPortal ? (
        <Link className="w-fit font-medium text-primary text-sm" href="/portal">
          Volver a las fases
        </Link>
      ) : null}
    </EntrevistaPantallaTransicion>
  );
}

function EntrevistaSkeleton() {
  return (
    <EntrevistaShell>
      <div className="flex flex-col gap-3 px-6 py-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    </EntrevistaShell>
  );
}
