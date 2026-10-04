"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CerrarSeccionEnChat } from "@/components/portal/cerrar-seccion-en-chat";
import { TerminarTemaAntesButton } from "@/components/portal/terminar-tema-antes-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import { useSaludoProgresivo } from "@/hooks/use-saludo-progresivo";
import { AVISO_VOZ } from "@/lib/consultoria/inicio-en-chat";
import type {
  Attachment,
  ChatMessage,
  SectionCompletedData,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export function ChatShell({
  composerAction,
  onSeccionCompletada,
  pieCompositor,
  sinAccionesMensaje = false,
}: {
  composerAction?: ReactNode;
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  /** Links under the composer, such as privacy and how the AI works. */
  pieCompositor?: ReactNode;
  /** Hides copy and edit controls under each message. */
  sinAccionesMensaje?: boolean;
} = {}) {
  const {
    chatId,
    demoAislada,
    demoVoz,
    esEntrevista,
    messages,
    setMessages,
    hayMensajeFallido,
    reintentarMensajeFallido,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    showCreditCardAlert,
    setShowCreditCardAlert,
    enviarInicio,
    inicioEnviando,
    inicioPendiente,
    mensajesInicio,
    recorridoBreve,
  } = useActiveChat();

  const saludo = useSaludoProgresivo({
    mensajesInicio,
    pendiente: inicioPendiente,
    sinHistorial: messages.length === 0,
  });
  const textoSaludo = (saludo.mensajes[0]?.parts ?? [])
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  const destacarMicrofono =
    recorridoBreve && inicioPendiente && textoSaludo.includes(AVISO_VOZ);
  const completarSaludoRef = useRef(saludo.completar);
  completarSaludoRef.current = saludo.completar;
  const inicioPendienteRef = useRef(inicioPendiente);
  inicioPendienteRef.current = inicioPendiente;
  const enviarInicioRef = useRef(enviarInicio);
  enviarInicioRef.current = enviarInicio;
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const enviarDesdeCompositor = useCallback<typeof sendMessage>(
    (mensaje, opciones) => {
      if (inicioPendienteRef.current) {
        const partes =
          mensaje && "parts" in mensaje && Array.isArray(mensaje.parts)
            ? mensaje.parts
            : [];
        const texto = partes
          .map((parte) => (parte.type === "text" ? parte.text : ""))
          .join(" ");
        completarSaludoRef.current();
        enviarInicioRef.current(texto);
        return Promise.resolve();
      }
      return sendMessageRef.current(mensaje, opciones);
    },
    []
  );
  const mensajesVisibles =
    saludo.mensajes.length > 0 ? [...saludo.mensajes, ...messages] : messages;
  const estadoVisible = inicioEnviando ? "submitted" : status;

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const artifactVisible = useArtifactSelector((state) => state.isVisible);
  const isArtifactVisible = artifactVisible && !esEntrevista;
  const { setArtifact } = useArtifact();

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact]);

  const advanceDeliveredRef = useRef(false);
  const [pendingAdvance, setPendingAdvance] =
    useState<SectionCompletedData | null>(null);

  const handleSeccionCompletada = useCallback((data: SectionCompletedData) => {
    setPendingAdvance(data);
  }, []);

  useEffect(() => {
    if (!pendingAdvance || advanceDeliveredRef.current) {
      return;
    }

    if (status === "submitted" || status === "streaming") {
      return;
    }

    advanceDeliveredRef.current = true;
    onSeccionCompletada?.(pendingAdvance);
  }, [onSeccionCompletada, pendingAdvance, status]);

  const handleEditMessage = useCallback(
    (msg: ChatMessage) => {
      const text = msg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      setInput(text ?? "");
      setEditingMessage(msg);
    },
    [setInput]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInput("");
  }, [setInput]);

  const handleSendEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    const msg = editingMessage;
    setEditingMessage(null);
    await submitEditedMessage({
      message: msg,
      regenerate,
      setMessages,
      text: input,
    });
    setInput("");
  }, [editingMessage, input, regenerate, setInput, setMessages]);

  const handleActivateGateway = useCallback(() => {
    window.open(
      "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
      "_blank"
    );
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
  }, []);

  return (
    <>
      <div
        className={cn(
          "flex w-full flex-row overflow-hidden",
          esEntrevista ? "h-full min-h-0 flex-1" : "h-dvh"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            !esEntrevista && "bg-sidebar",
            isArtifactVisible ? "w-[40%]" : "w-full"
          )}
        >
          {esEntrevista ? null : (
            <ChatHeader
              chatId={chatId}
              isReadonly={isReadonly}
              selectedVisibilityType={visibilityType}
            />
          )}

          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col overflow-hidden",
              esEntrevista ? "bg-white" : "bg-background",
              !esEntrevista &&
                "md:rounded-tl-[12px] md:border-t md:border-l md:border-border/40"
            )}
          >
            {saludo.escribiendo ? (
              <p className="sr-only" data-testid="saludo-completo">
                {saludo.textoCompleto}
              </p>
            ) : null}
            <Messages
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              esEntrevista={esEntrevista}
              isArtifactVisible={isArtifactVisible}
              isLoading={isLoading}
              isReadonly={isReadonly}
              messages={mensajesVisibles}
              onEditMessage={sinAccionesMensaje ? undefined : handleEditMessage}
              regenerate={regenerate}
              saludoEscribiendo={saludo.escribiendo}
              selectedModelId={currentModelId}
              setMessages={setMessages}
              sinAcciones={sinAccionesMensaje}
              status={estadoVisible}
              votes={votes}
            />

            {esEntrevista && !isReadonly ? (
              <div className="mx-auto flex w-full max-w-[760px] flex-col items-start gap-1 px-3 md:px-4">
                <CerrarSeccionEnChat placement="sticky" />
                <TerminarTemaAntesButton />
              </div>
            ) : null}

            <div
              className={cn(
                "sticky bottom-0 z-1 mx-auto flex w-full gap-2 border-t-0 bg-background pb-3 md:pb-4",
                esEntrevista
                  ? "max-w-[760px] bg-white px-3 md:px-4"
                  : "max-w-4xl bg-background px-2 md:px-4"
              )}
            >
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  composerAction={composerAction}
                  demoAislada={demoAislada}
                  demoVoz={demoVoz}
                  destacarMicrofono={destacarMicrofono}
                  editingMessage={editingMessage}
                  esEntrevista={esEntrevista}
                  hayMensajeFallido={hayMensajeFallido}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={handleCancelEdit}
                  onModelChange={setCurrentModelId}
                  reintentarMensajeFallido={reintentarMensajeFallido}
                  selectedModelId={currentModelId}
                  selectedVisibilityType={visibilityType}
                  sendMessage={
                    editingMessage
                      ? handleSendEditedMessage
                      : enviarDesdeCompositor
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={estadoVisible}
                  stop={stop}
                />
              )}
            </div>
            {pieCompositor && !isReadonly ? (
              <div className="mx-auto w-full max-w-[760px] bg-white px-3 pb-3 md:px-4">
                {pieCompositor}
              </div>
            ) : null}
          </div>
        </div>

        {esEntrevista ? null : (
          <Artifact
            addToolApprovalResponse={addToolApprovalResponse}
            attachments={attachments}
            chatId={chatId}
            input={input}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={currentModelId}
            selectedVisibilityType={visibilityType}
            sendMessage={sendMessage}
            setAttachments={setAttachments}
            setInput={setInput}
            setMessages={setMessages}
            status={status}
            stop={stop}
            votes={votes}
          />
        )}
      </div>

      <DataStreamHandler onSeccionCompletada={handleSeccionCompletada} />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateGateway}>
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
