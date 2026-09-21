"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { VolverAdminButton } from "@/components/auth/volver-admin-button";
import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import {
  mensajesDemoEntrevista,
  seccionDemoEntrevista,
} from "@/lib/consultoria/entrevista-demo";
import type { DemoVozEntrevista } from "@/lib/consultoria/entrevista-voz";
import { cn } from "@/lib/utils";

const ESTADOS_VOZ = [
  { href: "/vista-previa-entrevista", id: "ok", label: "Grabación simulada" },
  {
    href: "/vista-previa-entrevista?voz=denegado",
    id: "denegado",
    label: "Permiso denegado",
  },
  {
    href: "/vista-previa-entrevista?voz=sin-mic",
    id: "sin-mic",
    label: "Sin micrófono",
  },
  {
    href: "/vista-previa-entrevista?voz=fallo",
    id: "fallo",
    label: "Fallo al transcribir",
  },
] as const;

const CORREO_LARGO =
  "participante.con.apellido.muy.largo@compliancelatam.example";
const TITULO_LARGO =
  "Cómo se deciden altas, bajas y renovaciones en membresías comerciales";

function parseDemoVoz(valor: string | null): DemoVozEntrevista {
  if (
    valor === "denegado" ||
    valor === "sin-mic" ||
    valor === "fallo" ||
    valor === "ok"
  ) {
    return valor;
  }

  return "ok";
}

export function VistaPreviaEntrevistaCliente() {
  const searchParams = useSearchParams();
  const demoVoz = parseDemoVoz(searchParams.get("voz"));
  const mostrarPortal = searchParams.get("rol") === "cliente";
  const impersonar = searchParams.get("impersonar") === "1";
  const mostrarLab = searchParams.get("cabecera") !== "1";
  const correo = searchParams.get("email") || CORREO_LARGO;
  const temas = Number.parseInt(searchParams.get("temas") ?? "4", 10);
  const indice = Number.parseInt(searchParams.get("indice") ?? "0", 10);
  const tituloTema = searchParams.get("titulo") || seccionDemoEntrevista.titulo;
  const demoFalloGuardar = searchParams.get("guardar") === "error";
  const numeroSecciones = Number.isFinite(temas) && temas > 0 ? temas : 4;
  const indiceTema =
    Number.isFinite(indice) && indice >= 0
      ? Math.min(indice, numeroSecciones - 1)
      : 0;

  return (
    <div className="flex h-dvh flex-col bg-white">
      <Toaster position="top-center" />
      {impersonar ? (
        <div className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-amber-500/30 border-b bg-amber-500/10 px-3 py-1.5">
          <p className="text-amber-950 text-xs" role="status">
            Estás en el portal como Alex Pérez ({correo}). Lo que guardes queda
            a su nombre.
          </p>
          <VolverAdminButton />
        </div>
      ) : null}
      {mostrarLab ? (
        <nav
          aria-label="Estados simulados de audio"
          className="flex flex-wrap gap-2 border-border/40 border-b px-3 py-2 text-xs"
        >
          {ESTADOS_VOZ.map((estado) => (
            <Link
              className={cn(
                "rounded-full border px-2.5 py-1",
                demoVoz === estado.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-border text-muted-foreground"
              )}
              href={estado.href}
              key={estado.id}
            >
              {estado.label}
            </Link>
          ))}
          <span className="self-center text-muted-foreground">
            Audio y transcripción simulados. Sin Whisper ni modelo.
          </span>
        </nav>
      ) : null}
      <EntrevistaChat
        correoUsuario={correo}
        demoAislada
        demoFalloGuardar={demoFalloGuardar}
        demoVoz={demoVoz}
        entrevistaId="00000000-0000-4000-8000-000000000001"
        indice={indiceTema}
        mensajesIniciales={mensajesDemoEntrevista}
        mostrarPortal={mostrarPortal}
        numeroSecciones={numeroSecciones}
        seccion={{
          ...seccionDemoEntrevista,
          titulo: tituloTema || TITULO_LARGO,
        }}
        titulo="Entrevista"
      />
    </div>
  );
}
