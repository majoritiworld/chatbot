"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  crearAvisadorError,
  payloadReintento,
  ultimoMensajeUsuario,
} from "@/lib/consultoria/reintento-mensaje";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  /** True when the chat is pinned to an interview (client portal embed). */
  esEntrevista: boolean;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  hayMensajeFallido: boolean;
  reintentarMensajeFallido: () => void;
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
  entrevistaId?: string;
  seccionId?: string;
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  progresoGuardado: boolean;
  marcarProgresoGuardado: () => void;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({
  children,
  entrevistaId,
  mensajesIniciales,
  onSeccionCompletada,
  seccionId,
}: {
  children: ReactNode;
  /** Pins the chat to one interview. Used by the client portal embed. */
  entrevistaId?: string;
  /** Transcript already stored for this interview, replayed on reload. */
  mensajesIniciales?: ChatMessage[];
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  /** Active section snapshot for interview requests. */
  seccionId?: string;
}) {
  const pathname = usePathname();
  const { setDataStream, setWaitingStatus } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? entrevistaId ?? newChatIdRef.current;
  const esEntrevista = Boolean(entrevistaId);

  const entrevistaIdRef = useRef(entrevistaId);
  entrevistaIdRef.current = entrevistaId;
  const seccionIdRef = useRef(seccionId);
  seccionIdRef.current = seccionId;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [claveGuardada, setClaveGuardada] = useState<string | null>(null);
  const [mensajeFallido, setMensajeFallido] = useState<ChatMessage | null>(
    null
  );
  const avisarError = useRef(crearAvisadorError());
  const messagesErrorRef = useRef<ChatMessage[]>([]);
  const esEntrevistaRef = useRef(esEntrevista);
  esEntrevistaRef.current = esEntrevista;

  const { data: chatData, isLoading } = useSWR(
    isNewChat
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initialMessagesRef = useRef(mensajesIniciales);
  const initialMessages: ChatMessage[] = isNewChat
    ? (initialMessagesRef.current ?? [])
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
    clearError,
  } = useChat<ChatMessage>({
    generateId: generateUUID,
    id: chatId,
    messages: initialMessages,
    onData: (dataPart) => {
      if (dataPart.type === "data-waiting-status") {
        setWaitingStatus(dataPart.data);
        return;
      }
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onError: (error) => {
      setMensajeFallido(ultimoMensajeUsuario(messagesErrorRef.current));
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setShowCreditCardAlert(true);
        return;
      }
      const fallback = esEntrevistaRef.current
        ? "Ocurrió un error. Inténtalo de nuevo."
        : "Oops, an error occurred!";
      const mensaje =
        error instanceof ChatbotError
          ? error.message
          : error.message || fallback;
      avisarError.current(mensaje, (texto) => {
        toast({ description: texto, type: "error" });
      });
    },
    onFinish: () => {
      setMensajeFallido(null);
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);

        return {
          body: {
            entrevistaId: entrevistaIdRef.current,
            id: request.id,
            message: lastMessage?.role === "user" ? lastMessage : undefined,
            messages: request.messages,
            seccionId: seccionIdRef.current,
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            ...request.body,
          },
        };
      },
    }),
  });

  messagesErrorRef.current = messages;

  useEffect(() => {
    if (status === "submitted" || status === "ready" || status === "error") {
      setWaitingStatus(undefined);
    }
  }, [status, setWaitingStatus]);

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  useEffect(() => {
    if (chatData && !isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [chatData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    if (esEntrevista) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        parts: [{ text: query, type: "text" }],
        role: "user" as const,
      });
    }
  }, [sendMessage, chatId, esEntrevista]);

  // The interview opens itself: with no transcript to replay, ask the agent
  // for its greeting and first question instead of waiting on the user.
  const kickoffRef = useRef(false);
  useEffect(() => {
    if (!esEntrevista || kickoffRef.current) {
      return;
    }
    if (messages.length > 0) {
      kickoffRef.current = true;
      return;
    }
    if (status !== "ready") {
      return;
    }
    kickoffRef.current = true;
    sendMessage();
  }, [esEntrevista, messages.length, status, sendMessage]);

  useAutoResume({
    autoResume: !isNewChat && !!chatData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !(isReadonly || esEntrevista) && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const claveMensajes = messages.map((mensaje) => mensaje.id).join(",");
  const progresoGuardado =
    claveGuardada !== null && claveGuardada === claveMensajes;
  const marcarProgresoGuardado = useCallback(() => {
    setClaveGuardada(messages.map((mensaje) => mensaje.id).join(","));
  }, [messages]);

  const reintentarMensajeFallido = useCallback(() => {
    if (!mensajeFallido) {
      return;
    }
    clearError();
    sendMessage(payloadReintento(mensajeFallido));
  }, [clearError, mensajeFallido, sendMessage]);

  const hayMensajeFallido = status === "error" && Boolean(mensajeFallido);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      addToolApprovalResponse,
      chatId,
      currentModelId,
      entrevistaId,
      esEntrevista,
      hayMensajeFallido,
      input,
      isLoading: !isNewChat && isLoading,
      isReadonly,
      marcarProgresoGuardado,
      messages,
      onSeccionCompletada,
      progresoGuardado,
      regenerate,
      reintentarMensajeFallido,
      seccionId,
      sendMessage,
      setCurrentModelId,
      setInput,
      setMessages,
      setShowCreditCardAlert,
      showCreditCardAlert,
      status,
      stop,
      visibilityType: visibility,
      votes,
    }),
    [
      addToolApprovalResponse,
      chatId,
      currentModelId,
      entrevistaId,
      esEntrevista,
      hayMensajeFallido,
      input,
      isLoading,
      isNewChat,
      isReadonly,
      marcarProgresoGuardado,
      messages,
      onSeccionCompletada,
      progresoGuardado,
      regenerate,
      reintentarMensajeFallido,
      seccionId,
      sendMessage,
      setMessages,
      showCreditCardAlert,
      status,
      stop,
      visibility,
      votes,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
