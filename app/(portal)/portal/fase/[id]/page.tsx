import Link from "next/link";
import { Suspense } from "react";
import { EntrevistaEnCurso } from "@/components/portal/entrevista-en-curso";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { MarcaParticipanteProvider } from "@/components/portal/marca-participante";
import { SeguimientoFase } from "@/components/portal/seguimiento-fase";
import { Skeleton } from "@/components/ui/skeleton";
import { mostrarPortalFases } from "@/lib/consultoria/acceso-proyecto";
import {
  seccionesPublicas,
  turnosDeSeccion,
} from "@/lib/consultoria/entrevista-contenido";
import { getEntrevistaPropiaEnFaseDelProyecto } from "@/lib/consultoria/entrevistas";
import { getFase } from "@/lib/consultoria/fases";
import { esFaseColaboradores } from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import {
  comunicacionDeEntrevista,
  marcaConTextos,
  marcaPorProyectoId,
} from "@/lib/consultoria/marca-publica";
import { turnosAMensajes } from "@/lib/consultoria/mensajes-a-turnos";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { resolverVistaFasePortal } from "@/lib/consultoria/portal-carga-acceso";
import { isClienteRole } from "@/lib/consultoria/roles";
import {
  filtroDesdeParametros,
  listarSeguimientoFase,
} from "@/lib/consultoria/seguimiento-fase";

const AVISO_FASE = {
  bloqueada: "Esta fase todavía está bloqueada.",
  "sin-entrevista": "Esta fase todavía no tiene una entrevista asignada.",
  "sin-respondible":
    "El progreso de las entrevistas de esta fase se ve en el listado. Solo quien fue invitado puede responder.",
} as const;

export default function FasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<FaseSkeleton />}>
      <FaseContenido
        id={params.then((routeParams) => routeParams.id)}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

function textoParametro(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : undefined;
}

async function FaseContenido({
  id,
  searchParams,
}: {
  id: Promise<string>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const portalUser = await requirePortalUser();
  const mostrarPortal = mostrarPortalFases({
    proyectoEntrevistaId: portalUser.proyectoId,
    proyectoOrigenId: portalUser.proyectoId,
    rol: portalUser.rol,
  });
  const faseId = await id;
  const [fase, propia] = await Promise.all([
    getFase(portalUser.proyectoId, faseId, {
      email: portalUser.email,
      rol: portalUser.rol,
    }),
    getEntrevistaPropiaEnFaseDelProyecto({
      faseId,
      proyectoId: portalUser.proyectoId,
      viewerEmail: portalUser.email,
    }),
  ]);

  if (
    fase &&
    isClienteRole(portalUser.rol) &&
    esFaseColaboradores(fase) &&
    portalUser.proyectoId
  ) {
    const crudo = await searchParams;
    const filtro = filtroDesdeParametros({
      empresa: textoParametro(crudo.empresa),
      estado: textoParametro(crudo.estado),
      orden: textoParametro(crudo.orden),
      page: textoParametro(crudo.page),
      pais: textoParametro(crudo.pais),
      persona: textoParametro(crudo.persona),
      q: textoParametro(crudo.q),
      tamano: textoParametro(crudo.tamano),
    });
    const pagina = await listarSeguimientoFase(fase.id, filtro);
    const completadas = fase.seguimiento?.completadas ?? 0;
    const asignadas = fase.seguimiento?.asignadas ?? 0;
    return (
      <FaseLayout
        correoUsuario={portalUser.email}
        mostrarPortal={mostrarPortal}
        nombre={fase.nombre}
      >
        <div className="flex flex-col gap-4 px-6 py-8">
          <p className="text-sm">
            {completadas} de {asignadas} completadas
            {asignadas > 0
              ? ` (${Math.round((completadas / asignadas) * 100)}%)`
              : ""}
            . Sin iniciar: {fase.seguimiento?.sinIniciar ?? 0}. En curso:{" "}
            {fase.seguimiento?.enCurso ?? 0}.
          </p>
          <SeguimientoFase faseId={fase.id} filtro={filtro} pagina={pagina} />
        </div>
      </FaseLayout>
    );
  }

  const vista = resolverVistaFasePortal(fase, propia);

  // Blocked and unknown phases render a message rather than redirecting:
  // this component streams, so a redirect here would become a meta refresh.
  if (vista.tipo === "ausente") {
    return (
      <FaseLayout
        correoUsuario={portalUser.email}
        mostrarPortal={mostrarPortal}
      >
        <FaseAviso
          mensaje="Esta fase no existe o no pertenece a tu proyecto."
          mostrarPortal={mostrarPortal}
        />
      </FaseLayout>
    );
  }

  if (vista.tipo === "aviso") {
    return (
      <FaseLayout
        correoUsuario={portalUser.email}
        mostrarPortal={mostrarPortal}
        nombre={vista.nombre}
      >
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

  const presentacion = await comunicacionDeEntrevista(entrevista.id);
  const marca = marcaConTextos(
    await marcaPorProyectoId(entrevista.proyecto_id),
    presentacion.textos
  );
  const mostrarFases = mostrarPortalFases({
    proyectoEntrevistaId: entrevista.proyecto_id,
    proyectoOrigenId: portalUser.proyectoId,
    rol: portalUser.rol,
  });

  return (
    <MarcaParticipanteProvider marca={marca}>
      <EntrevistaEnCurso
        cliente={entrevista.proyecto_cliente}
        consentimientoEn={entrevista.consentimiento_en}
        correoAgradecimientoEn={entrevista.correo_agradecimiento_en}
        correoUsuario={portalUser.email}
        entrevistaId={entrevista.id}
        estadoInicial={entrevista.estado}
        flujoEstadoInicial={entrevista.flujo_estado}
        mensajesIniciales={turnosAMensajes(turnosActivos)}
        minutos={presentacion.minutos}
        mostrarPortal={mostrarFases}
        seccionActualInicial={entrevista.seccion_actual}
        secciones={seccionesPublicas(entrevista.secciones)}
        stakeholderNombre={entrevista.stakeholder_nombre}
        titulo={nombre}
      />
    </MarcaParticipanteProvider>
  );
}

function FaseLayout({
  children,
  correoUsuario,
  mostrarPortal = true,
  nombre,
}: {
  children?: React.ReactNode;
  correoUsuario?: string | null;
  mostrarPortal?: boolean;
  nombre?: string;
}) {
  return (
    <EntrevistaShell
      compactoMovil
      correoUsuario={correoUsuario}
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
