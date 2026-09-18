"use client";

import { TourGuia, type TourPaso } from "@/components/portal/tour-guia";
import { useActiveChat } from "@/hooks/use-active-chat";

const PASOS: TourPaso[] = [
  {
    descripcion:
      "El entrevistador te hará preguntas y aparecerán aquí, en el chat. Tú respondes cuando quieras, una a una.",
    id: "preguntas",
    prefer: "right",
    selector: '[data-tour="entrevista-chat"]',
    titulo: "Las preguntas",
  },
  {
    descripcion:
      "Puedes escribir tu respuesta o pulsar Hablar, decirla en voz alta y volver a pulsar el botón para transcribirla. Pruébalo ahora si quieres: habla un momento y clickea de nuevo para ver cómo queda el texto.",
    id: "hablar",
    prefer: "top",
    selector: '[data-tour="entrevista-hablar"]',
    titulo: "Escribe o habla",
  },
  {
    descripcion:
      "Si necesitas parar, guarda tu progreso. Puedes salir y continuar otro día desde donde lo dejaste.",
    id: "guardar",
    prefer: "left",
    selector: '[data-tour="entrevista-guardar"]',
    titulo: "Guarda y vuelve luego",
  },
  {
    descripcion:
      "Si pulsas Finalizar sección antes de cubrir todos los temas, puedes continuar, guardar y volver otro día, o cerrar de todas maneras.",
    id: "finalizar",
    prefer: "bottom",
    selector: '[data-tour="entrevista-finalizar"]',
    titulo: "Finalizar sección",
  },
];

export function EntrevistaTour({
  entrevistaId,
  habilitado,
}: {
  entrevistaId: string;
  habilitado: boolean;
}) {
  const { messages, status } = useActiveChat();
  const chatListo = status === "ready" && messages.length > 0;

  return (
    <TourGuia
      ariaId="entrevista-tour"
      habilitado={habilitado && chatListo}
      pasos={PASOS}
      storageKey={`mj-entrevista-chat-tour:${entrevistaId}`}
    />
  );
}
