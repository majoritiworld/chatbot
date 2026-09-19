import Link from "next/link";
import { Suspense } from "react";
import { EntrevistaEnCurso } from "@/components/portal/entrevista-en-curso";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { turnosDeSeccion } from "@/lib/consultoria/entrevista-contenido";
import { getEntrevistaPropiaEnFaseDelProyecto } from "@/lib/consultoria/entrevistas";
import { getFase } from "@/lib/consultoria/fases";
import { turnosAMensajes } from "@/lib/consultoria/mensajes-a-turnos";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { resolverVistaFasePortal } from "@/lib/consultoria/portal-carga-acceso";
import { isClienteRole } from "@/lib/consultoria/roles";

const AVISO_FASE = {
  bloqueada: "Esta fase todavía está bloqueada.",
  "sin-entrevista": "Esta fase todavía no tiene una entrevista asignada.",
  "sin-respondible":
    "El progreso de las entrevistas de esta fase se ve en el listado. Solo quien fue invitado puede responder.",
} as const;

export default function FasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<FaseSkeleton />}>
      <FaseContenido id={params.then((routeParams) => routeParams.id)} />
    </Suspense>
  );
}

async function FaseContenido({ id }: { id: Promise<string> }) {
  const portalUser = await requirePortalUser();
  const mostrarPortal = isClienteRole(portalUser.rol);
  const faseId = await id;
  const [fase, propia] = await Promise.all([
    getFase(portalUser.proyectoId, faseId, portalUser.email),
    getEntrevistaPropiaEnFaseDelProyecto({
      faseId,
      proyectoId: portalUser.proyectoId,
      viewerEmail: portalUser.email,
    }),
  ]);

  const vista = resolverVistaFasePortal(fase, propia);

  // Blocked and unknown phases render a message rather than redirecting:
  // this component streams, so a redirect here would become a meta refresh.
  if (vista.tipo === "ausente") {
    return (
      <FaseLayout mostrarPortal={mostrarPortal}>
        <FaseAviso
          mensaje="Esta fase no existe o no pertenece a tu proyecto."
          mostrarPortal={mostrarPortal}
        />
      </FaseLayout>
    );
  }

  if (vista.tipo === "aviso") {
    return (
      <FaseLayout mostrarPortal={mostrarPortal} nombre={vista.nombre}>
        <FaseAviso
          mensaje={AVISO_FASE[vista.clave]}
          mostrarPortal={mostrarPortal}
        />
      </FaseLayout>
    );
  }

  const { entrevista, turnos, nombre } = vista;
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
      titulo={nombre}
    />
  );
}

function FaseLayout({
  children,
  mostrarPortal = true,
  nombre,
}: {
  children?: React.ReactNode;
  mostrarPortal?: boolean;
  nombre?: string;
}) {
  return (
    <EntrevistaShell
      mostrarPortal={mostrarPortal}
      titulo={nombre ?? <Skeleton className="h-3 w-40" />}
    >
      {children}
    </EntrevistaShell>
  );
}

function FaseAviso({
  mensaje,
  mostrarPortal,
}: {
  mensaje: string;
  mostrarPortal: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-8">
      <p className="text-muted-foreground text-sm">{mensaje}</p>
      {mostrarPortal ? (
        <Link className="font-medium text-primary text-sm" href="/portal">
          Volver a las fases
        </Link>
      ) : null}
    </div>
  );
}

function FaseSkeleton() {
  return <FaseLayout />;
}
