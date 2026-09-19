import type { ChatTransport, UIMessageChunk } from "ai";
import type { ChatMessage } from "@/lib/types";

function streamVacio() {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.close();
    },
  });
}

export const transporteChatAislado: ChatTransport<ChatMessage> = {
  reconnectToStream: () => Promise.resolve(null),
  sendMessages: () => Promise.resolve(streamVacio()),
};
