import { type ToolSet, toUIMessageStream } from "ai";
import type { ChatMessage } from "@/lib/types";

export class ErrorGuardadoTranscripcion extends Error {
  constructor(options: ErrorOptions) {
    super(
      "No se pudo guardar la conversación. Intenta guardar el progreso antes de salir.",
      options
    );
    this.name = "ErrorGuardadoTranscripcion";
  }
}

/** Persist the exact assembled message delivered to the browser, including
 * its ID and all text steps. Never manufacture a second transcript ID. */
export function streamEntrevista({
  stream,
  sendReasoning,
  guardar,
  despuesDeGuardar,
}: {
  stream: Parameters<typeof toUIMessageStream>[0]["stream"];
  sendReasoning: boolean;
  guardar: (message: ChatMessage) => Promise<void>;
  despuesDeGuardar?: () => void;
}) {
  return toUIMessageStream<ToolSet, ChatMessage>({
    generateMessageId: () => crypto.randomUUID(),
    onEnd: async ({ responseMessage }) => {
      try {
        await guardar(responseMessage);
      } catch (error) {
        // biome-ignore lint/style/useErrorCause: this subclass forwards options.cause to Error
        throw new ErrorGuardadoTranscripcion({ cause: error });
      }
      // Announce section changes only once its last message is persisted.
      despuesDeGuardar?.();
    },
    sendReasoning,
    stream,
  });
}
