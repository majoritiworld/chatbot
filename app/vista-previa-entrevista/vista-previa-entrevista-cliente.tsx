"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
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

  return (
    <div className="flex h-dvh flex-col bg-white">
      <Toaster position="top-center" />
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
      <EntrevistaChat
        demoAislada
        demoVoz={demoVoz}
        entrevistaId="00000000-0000-4000-8000-000000000001"
        indice={0}
        mensajesIniciales={mensajesDemoEntrevista}
        mostrarPortal={false}
        numeroSecciones={4}
        seccion={seccionDemoEntrevista}
        titulo="Entrevista"
      />
    </div>
  );
}
