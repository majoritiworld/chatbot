import Link from "next/link";
import { Suspense } from "react";
import { EntrevistaEnCurso } from "@/components/portal/entrevista-en-curso";
import { EntrevistaLectura } from "@/components/portal/entrevista-lectura";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { MarcaParticipanteProvider } from "@/components/portal/marca-participante";
import { Skeleton } from "@/components/ui/skeleton";
import { mostrarPortalFases } from "@/lib/consultoria/acceso-proyecto";
import { turnosDeSeccion } from "@/lib/consultoria/entrevista-contenido";
import { getEntrevistaPortalCarga } from "@/lib/consultoria/entrevistas";
import {
  comunicacionDeEntrevista,
  marcaConTextos,
  marcaPorProyectoId,
  proyectoIdDeEntrevista,
} from "@/lib/consultoria/marca-publica";
import { turnosAMensajes } from "@/lib/consultoria/mensajes-a-turnos";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { sintesisConsultaGuardada } from "@/lib/consultoria/sintesis-consulta";

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
        correoUsuario={portalUser.email}
        entrevistaId={entrevista.id}
        estadoInicial={entrevista.estado}
        flujoEstadoInicial={entrevista.flujo_estado}
        mensajesIniciales={turnosAMensajes(turnosActivos)}
        minutos={presentacion?.minutos ?? null}
        mostrarPortal={mostrarPortal}
        seccionActualInicial={entrevista.seccion_actual}
        secciones={entrevista.secciones}
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
