import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import type { ChatMessage } from "@/lib/types";

const TEXTO_LARGO =
  "Cerramos dos cuentas grandes y el comité pidió más claridad en altas, bajas y renovaciones. El equipo comercial sigue vendiendo con la hoja de cálculo de siempre, así que cada persona interpreta las reglas de membresía de forma distinta. En operaciones no sabemos qué está vigente hasta que alguien reclama. Eso nos atrasó el cierre del trimestre y dejó a tres clientes sin respuesta útil durante más de una semana. Necesitamos un criterio único, visible para todos, antes de volver a prometer plazos.";

function mensaje(
  id: string,
  role: "assistant" | "user",
  texto: string,
  extra: ChatMessage["parts"] = []
): ChatMessage {
  return {
    id,
    metadata: { createdAt: "2026-09-19T12:00:00.000Z" },
    parts: [{ text: texto, type: "text" }, ...extra],
    role,
  };
}

export const seccionDemoEntrevista: SeccionEntrevista = {
  descripcion: "Qué cambió y dónde duele el proceso.",
  id: "demo-diagnostico",
  preguntas: ["¿Qué cambió en el último trimestre?"],
  titulo: "Diagnóstico",
};

export const mensajesDemoEntrevista: ChatMessage[] = [
  mensaje(
    "demo-a1",
    "assistant",
    "Hola, Alex. Para empezar: ¿qué cambió en el último trimestre?"
  ),
  mensaje(
    "demo-u1",
    "user",
    "Cerramos dos cuentas y el comité pidió más claridad en membresías."
  ),
  mensaje(
    "demo-a2",
    "assistant",
    "¿Cómo se nota eso en el día a día del equipo?"
  ),
  mensaje("demo-u2", "user", TEXTO_LARGO),
  mensaje(
    "demo-a3",
    "assistant",
    "Con eso cubro este tema. Cuando quieras, cierra y pasamos al siguiente.",
    [
      {
        input: { listo: true },
        output: { ok: true },
        state: "output-available",
        toolCallId: "demo-cierre",
        type: "tool-ofrecerCierreSeccion",
      },
    ]
  ),
];
