"use client";

import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import {
  mensajesDemoEntrevista,
  seccionDemoEntrevista,
} from "@/lib/consultoria/entrevista-demo";

export function VistaPreviaEntrevistaCliente() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <EntrevistaChat
        demoAislada
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
