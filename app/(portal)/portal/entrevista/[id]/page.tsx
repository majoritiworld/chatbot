import Link from "next/link";
import { Suspense } from "react";
import { EntrevistaEnCurso } from "@/components/portal/entrevista-en-curso";
import { EntrevistaLectura } from "@/components/portal/entrevista-lectura";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { MarcaParticipanteProvider } from "@/components/portal/marca-participante";
import { Skeleton } from "@/components/ui/skeleton";
import { mostrarPortalFases } from "@/lib/consultoria/acceso-proyecto";
import {
  seccionesPublicas,
  type TurnoEntrevista,
  turnosDeSeccion,
} from "@/lib/consultoria/entrevista-contenido";
import {
  getEntrevistaEnlace,
  getEntrevistaPortalCarga,
  getUsuarioPerfil,
} from "@/lib/consultoria/entrevistas";
import {
  comunicacionDeEntrevista,
  marcaConTextos,
  marcaPorProyectoId,
  proyectoIdDeEntrevista,
} from "@/lib/consultoria/marca-publica";
import { turnosAMensajes } from "@/lib/consultoria/mensajes-a-turnos";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { asignacionTieneAccesoSoloCorreo } from "@/lib/consultoria/roles";
import { puedeAbrirAsignacionConSesionHabitual } from "@/lib/consultoria/sesion-entrevista";
import { sintesisConsultaGuardada } from "@/lib/consultoria/sintesis-consulta";
import { createClient } from "@/lib/supabase/server";
import type { Entrevista } from "@/lib/supabase/types";

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
  const enlace = await getEntrevistaEnlace(entrevistaId);
  if (enlace) {
    const presentacion = await comunicacionDeEntrevista(entrevistaId);
    const marca = marcaConTextos(
      await marcaPorProyectoId(enlace.entrevista.proyecto_id),
      presentacion.textos
    );
    const seccionActiva = enlace.entrevista.secciones.at(
      enlace.entrevista.seccion_actual
    );
    const turnosActivos = seccionActiva
      ? turnosDeSeccion(
          enlace.turnos,
          seccionActiva.id,
          enlace.entrevista.seccion_actual === 0
        )
      : [];
    return (
      <MarcaParticipanteProvider marca={marca}>
        <EntrevistaEnCurso
          cliente={enlace.entrevista.proyecto_cliente}
          consentimientoEn={enlace.entrevista.consentimiento_en}
          correoAgradecimientoEn={enlace.entrevista.correo_agradecimiento_en}
          correoUsuario={enlace.entrevista.stakeholder_email}
          entrevistaId={enlace.entrevista.id}
          estadoInicial={enlace.entrevista.estado}
          flujoEstadoInicial={enlace.entrevista.flujo_estado}
          mensajesIniciales={turnosAMensajes(turnosActivos)}
          minutos={presentacion.minutos}
          mostrarPortal={false}
          seccionActualInicial={enlace.entrevista.seccion_actual}
          secciones={seccionesPublicas(enlace.entrevista.secciones)}
          stakeholderNombre={enlace.entrevista.stakeholder_nombre}
        />
      </MarcaParticipanteProvider>
    );
  }

  const habitual = await getUsuarioPerfil();
  if (habitual?.user.email) {
    const supabase = await createClient();
    const soloCorreo = await asignacionTieneAccesoSoloCorreo(
      supabase,
      entrevistaId,
      habitual.user.email
    );
    if (
      puedeAbrirAsignacionConSesionHabitual({
        accesoSoloCorreo: soloCorreo,
        emailAsignacion: habitual.user.email,
        emailHabitual: habitual.user.email,
        rolHabitual: habitual.rol,
      })
    ) {
      const cargaHabitual = await getEntrevistaPortalCarga(
        entrevistaId,
        habitual.user.email,
        { proyectoId: null, rol: habitual.rol }
      );
      if (cargaHabitual.acceso === "propia") {
        return (
          <EntrevistaPropia
            correoUsuario={habitual.user.email}
            entrevista={cargaHabitual.entrevista}
            mostrarPortal={false}
            turnos={cargaHabitual.turnos}
          />
        );
      }
    }
  }

  const portalUser = await requirePortalUser({ conProyecto: false });
  const carga = await getEntrevistaPortalCarga(entrevistaId, portalUser.email, {
    proyectoId: portalUser.proyectoId,
    rol: portalUser.rol,
  });
  const proyectoEntrevista =
    carga.acceso === "propia"
      ? carga.entrevista.proyecto_id
      : await proyectoIdDeEntrevista(entrevistaId);
  const mostrarPortal = mostrarPortalFases({
    proyectoEntrevistaId: proyectoEntrevista,
    proyectoOrigenId: portalUser.proyectoId,
    rol: portalUser.rol,
  });

  const presentacion =
    carga.acceso === "propia" || carga.acceso === "lectura"
      ? await comunicacionDeEntrevista(entrevistaId)
      : null;
  const marca = marcaConTextos(
    await marcaPorProyectoId(
      carga.acceso === "propia" || carga.acceso === "lectura"
        ? carga.entrevista.proyecto_id
        : null
    ),
    presentacion?.textos ?? {
      avisoRespuestas: null,
      textoBienvenida: null,
    }
  );

  if (carga.acceso === "ausente") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={portalUser.email}
        mostrarPortal={mostrarPortal}
      >
        <Aviso
          mensaje="Esta entrevista no existe o no te corresponde."
          mostrarPortal={mostrarPortal}
        />
      </EntrevistaShell>
    );
  }

  if (carga.acceso === "lectura") {
    return (
      <MarcaParticipanteProvider marca={marca}>
        <EntrevistaShell
          compactoMovil
          correoUsuario={portalUser.email}
          mostrarPortal={mostrarPortal}
          titulo={carga.entrevista.stakeholder_nombre}
        >
          <EntrevistaLectura
            consulta={sintesisConsultaGuardada(carga.entrevista.resumen)}
            entrevistaId={carga.entrevista.id}
            enviada={carga.entrevista.estado === "completada"}
            nombre={carga.entrevista.stakeholder_nombre ?? null}
            turnos={carga.turnos}
          />
        </EntrevistaShell>
      </MarcaParticipanteProvider>
    );
  }

  if (carga.acceso === "ajena") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={portalUser.email}
        mostrarPortal={mostrarPortal}
      >
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

  const { entrevista, turnos } = carga;

  return (
    <EntrevistaPropia
      correoUsuario={portalUser.email}
      entrevista={entrevista}
      mostrarPortal={mostrarPortal}
      turnos={turnos}
    />
  );
}

async function EntrevistaPropia({
  correoUsuario,
  entrevista,
  mostrarPortal,
  turnos,
}: {
  correoUsuario: string | null;
  entrevista: Entrevista;
  mostrarPortal: boolean;
  turnos: TurnoEntrevista[];
}) {
  const presentacion = await comunicacionDeEntrevista(entrevista.id);
  const marca = marcaConTextos(
    await marcaPorProyectoId(entrevista.proyecto_id),
    presentacion.textos
  );
  const seccionActiva = entrevista.secciones.at(entrevista.seccion_actual);
  const turnosActivos = seccionActiva
    ? turnosDeSeccion(turnos, seccionActiva.id, entrevista.seccion_actual === 0)
    : [];

  return (
    <MarcaParticipanteProvider marca={marca}>
      <EntrevistaEnCurso
        cliente={entrevista.proyecto_cliente}
        consentimientoEn={entrevista.consentimiento_en}
        correoAgradecimientoEn={entrevista.correo_agradecimiento_en}
        correoUsuario={correoUsuario}
        entrevistaId={entrevista.id}
        estadoInicial={entrevista.estado}
        flujoEstadoInicial={entrevista.flujo_estado}
        mensajesIniciales={turnosAMensajes(turnosActivos)}
        minutos={presentacion.minutos}
        mostrarPortal={mostrarPortal}
        seccionActualInicial={entrevista.seccion_actual}
        secciones={seccionesPublicas(entrevista.secciones)}
        stakeholderNombre={entrevista.stakeholder_nombre}
      />
    </MarcaParticipanteProvider>
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
    <EntrevistaShell compactoMovil mostrarPortal={false}>
      <div className="flex flex-col gap-3 px-6 py-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    </EntrevistaShell>
  );
}
