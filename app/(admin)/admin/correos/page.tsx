import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { siteUrl } from "@/lib/consultoria/auth";
import { remitenteConNombre } from "@/lib/consultoria/comunicacion";
import {
  MENSAJES_BLOQUEO,
  type MotivoBloqueoCorreo,
} from "@/lib/consultoria/correos/asignacion";
import {
  filasDeProyectoParaVistaPrevia,
  permitirOrigenLocal,
} from "@/lib/consultoria/correos/asignacion-servidor";
import {
  correoParaVistaPrevia,
  EJEMPLOS_CORREO,
  ejemploCorreo,
} from "@/lib/consultoria/correos/ejemplos";
import type { ModoAcceso } from "@/lib/consultoria/correos/enlace-acceso";
import type { TipoCorreo } from "@/lib/consultoria/correos/variantes";
import { listProyectosConProgresoAdmin } from "@/lib/consultoria/stakeholders";
import { cn } from "@/lib/utils";

type Busqueda = Promise<{
  acceso?: string;
  ancho?: string;
  ejemplo?: string;
  fase?: string;
  imagenes?: string;
  proyecto?: string;
  tema?: string;
  tipo?: string;
}>;

type Opciones = {
  acceso: "fase" | ModoAcceso;
  ancho: "escritorio" | "movil";
  ejemplo: string;
  fase: string | null;
  imagenes: boolean;
  proyecto: string | null;
  tema: "claro" | "invertido";
  tipo: TipoCorreo;
};

export default function VistaPreviaCorreosPage({
  searchParams,
}: {
  searchParams: Busqueda;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <VistaPrevia searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function accesoDeBusqueda(valor: string | undefined): Opciones["acceso"] {
  if (valor === "codigo" || valor === "enlace_personal") {
    return valor;
  }
  return "fase";
}

function hrefCon(opciones: Opciones, cambio: Partial<Opciones>) {
  const final = { ...opciones, ...cambio };
  const params = new URLSearchParams({
    acceso: final.acceso,
    ancho: final.ancho,
    imagenes: final.imagenes ? "1" : "0",
    tema: final.tema,
    tipo: final.tipo,
  });
  if (final.proyecto) {
    params.set("proyecto", final.proyecto);
    if (final.fase) {
      params.set("fase", final.fase);
    }
  } else {
    params.set("ejemplo", final.ejemplo);
  }
  return `/admin/correos?${params.toString()}`;
}

function Opcion({
  activa,
  children,
  href,
}: {
  activa: boolean;
  children: string;
  href: string;
}) {
  return (
    <Link
      aria-current={activa ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        activa
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
      href={href}
      scroll={false}
    >
      {children}
    </Link>
  );
}

function Grupo({ children, titulo }: { children: ReactNode; titulo: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-muted-foreground text-xs">
        {titulo}
      </span>
      {children}
    </div>
  );
}

async function VistaPrevia({ searchParams }: { searchParams: Busqueda }) {
  await requireAdminUser();
  const busqueda = await searchParams;
  const opciones: Opciones = {
    acceso: accesoDeBusqueda(busqueda.acceso),
    ancho: busqueda.ancho === "movil" ? "movil" : "escritorio",
    ejemplo: ejemploCorreo(busqueda.ejemplo)?.id ?? "compliance-latam",
    fase: busqueda.fase ?? null,
    imagenes: busqueda.imagenes !== "0",
    proyecto: busqueda.proyecto ?? null,
    tema: busqueda.tema === "invertido" ? "invertido" : "claro",
    tipo: busqueda.tipo === "invitacion" ? "invitacion" : "confirmacion",
  };

  const site = siteUrl();
  const permitirLocal = permitirOrigenLocal();
  const proyectos = await listProyectosConProgresoAdmin();
  const real = opciones.proyecto
    ? await filasDeProyectoParaVistaPrevia(opciones.proyecto, opciones.fase)
    : null;
  const ejemplo = ejemploCorreo(opciones.ejemplo);
  const filasAsignacion = real?.filas ?? ejemplo?.filas;

  const correo = filasAsignacion
    ? correoParaVistaPrevia({
        acceso: opciones.acceso === "fase" ? undefined : opciones.acceso,
        filasAsignacion,
        imagenes: opciones.imagenes,
        logo: real ? undefined : ejemplo?.logo,
        permitirLocal,
        site,
        tipo: opciones.tipo,
      })
    : { error: "sin_entrevista" };
  const buzon = process.env.INTERVIEW_EMAIL_FROM?.trim();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Vista previa de correos</h1>
        <p className="text-muted-foreground text-sm">
          Solo muestra el mensaje. Nada de esta página envía correos.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <Grupo titulo="Correo">
          <Opcion
            activa={opciones.tipo === "confirmacion"}
            href={hrefCon(opciones, { tipo: "confirmacion" })}
          >
            Confirmación
          </Opcion>
          <Opcion
            activa={opciones.tipo === "invitacion"}
            href={hrefCon(opciones, { tipo: "invitacion" })}
          >
            Invitación
          </Opcion>
        </Grupo>
        <Grupo titulo="Ejemplo">
          {EJEMPLOS_CORREO.map((item) => (
            <Opcion
              activa={!opciones.proyecto && opciones.ejemplo === item.id}
              href={hrefCon(opciones, {
                ejemplo: item.id,
                fase: null,
                proyecto: null,
              })}
              key={item.id}
            >
              {item.etiqueta}
            </Opcion>
          ))}
        </Grupo>
        <Grupo titulo="Proyecto real">
          {proyectos.map((proyecto) => (
            <Opcion
              activa={opciones.proyecto === proyecto.id}
              href={hrefCon(opciones, { fase: null, proyecto: proyecto.id })}
              key={proyecto.id}
            >
              {`${proyecto.cliente} · ${proyecto.nombre}`}
            </Opcion>
          ))}
        </Grupo>
        {real && real.fases.length > 0 ? (
          <Grupo titulo="Fase">
            {real.fases.map((fase) => (
              <Opcion
                activa={real.faseId === fase.id}
                href={hrefCon(opciones, { fase: fase.id })}
                key={fase.id}
              >
                {fase.nombre}
              </Opcion>
            ))}
          </Grupo>
        ) : null}
        {opciones.tipo === "invitacion" ? (
          <Grupo titulo="Acceso">
            <Opcion
              activa={opciones.acceso === "fase"}
              href={hrefCon(opciones, { acceso: "fase" })}
            >
              Según la fase
            </Opcion>
            <Opcion
              activa={opciones.acceso === "codigo"}
              href={hrefCon(opciones, { acceso: "codigo" })}
            >
              Correo y código
            </Opcion>
            <Opcion
              activa={opciones.acceso === "enlace_personal"}
              href={hrefCon(opciones, { acceso: "enlace_personal" })}
            >
              Enlace personal
            </Opcion>
          </Grupo>
        ) : null}
        <Grupo titulo="Ancho">
          <Opcion
            activa={opciones.ancho === "escritorio"}
            href={hrefCon(opciones, { ancho: "escritorio" })}
          >
            Escritorio
          </Opcion>
          <Opcion
            activa={opciones.ancho === "movil"}
            href={hrefCon(opciones, { ancho: "movil" })}
          >
            Móvil (375 px)
          </Opcion>
        </Grupo>
        <Grupo titulo="Revisión">
          <Opcion
            activa={!opciones.imagenes}
            href={hrefCon(opciones, { imagenes: !opciones.imagenes })}
          >
            Imágenes bloqueadas
          </Opcion>
          <Opcion
            activa={opciones.tema === "invertido"}
            href={hrefCon(opciones, {
              tema: opciones.tema === "invertido" ? "claro" : "invertido",
            })}
          >
            Inversión de modo oscuro (aproximada)
          </Opcion>
        </Grupo>
      </section>

      {real?.faltaMigracion && opciones.tipo === "invitacion" ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
          La base todavía no tiene los textos de invitación. Se muestran los
          textos predeterminados.
        </p>
      ) : null}

      {"error" in correo ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          {correo.error in MENSAJES_BLOQUEO
            ? MENSAJES_BLOQUEO[correo.error as MotivoBloqueoCorreo]
            : "El sitio no tiene un origen autorizado para los enlaces."}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex justify-center overflow-x-auto rounded-xl border border-border bg-muted/30 p-4">
            <iframe
              className="rounded-md border-0 bg-white"
              height={1100}
              sandbox=""
              srcDoc={correo.html}
              style={{
                filter:
                  opciones.tema === "invertido"
                    ? "invert(1) hue-rotate(180deg)"
                    : undefined,
                width: opciones.ancho === "movil" ? 375 : 680,
              }}
              title={`Vista previa: ${correo.subject}`}
            />
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <Dato titulo="Asunto">{correo.subject}</Dato>
            <Dato titulo="Remitente">
              {remitenteConNombre(
                buzon ?? "INTERVIEW_EMAIL_FROM",
                correo.remitenteVisible
              )}
            </Dato>
            <Dato titulo="Responder a">{correo.replyTo}</Dato>
            <Dato titulo="Para">{correo.destinatario}</Dato>
            <Dato titulo="Copia oculta">
              {correo.tipo === "confirmacion"
                ? process.env.INTERVIEW_EMAIL_BCC?.trim() ||
                  "hello@majoriti.world"
                : "Ninguna (las invitaciones no se copian)"}
            </Dato>
            <Dato titulo="Vista previa en bandeja">{correo.preview}</Dato>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs">Texto plano</dt>
              <dd>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
                  {correo.text}
                </pre>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </>
  );
}

function Dato({ children, titulo }: { children: string; titulo: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{titulo}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
