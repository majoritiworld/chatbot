"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  ArrowUpIcon,
  BrainIcon,
  EyeIcon,
  LockIcon,
  MicIcon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  BOTON_ICONO_COMPOSITOR_ENTREVISTA,
  EntrevistaVozCompositor,
} from "@/components/portal/entrevista-voz-compositor";
import { useEntrevistaVoz } from "@/hooks/use-entrevista-voz";
import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  type ModelCapabilities,
} from "@/lib/ai/models";
import type { ModoVozEntrevista } from "@/lib/consultoria/entrevista-voz";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";
import { SuggestedActions } from "./suggested-actions";
import type { VisibilityType } from "./visibility-selector";

function placeholderTexto(
  esEntrevista: boolean | undefined,
  editando: boolean
) {
  if (esEntrevista) {
    return editando ? "Editar tu mensaje…" : "Escribe tu respuesta…";
  }
  return editando ? "Edit your message..." : "Ask anything...";
}

function esMac() {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent)
  );
}

function etiquetaAtajoVoz() {
  return esMac() ? "⌥ Espacio" : "Alt+Espacio";
}

function esAtajoMicrófono(event: {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}) {
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.code === "Space" || event.key === " " || event.key === "\u00a0")
  );
}

function textoBotonVoz(voiceState: "idle" | "recording" | "transcribing") {
  if (voiceState === "transcribing") {
    return "Transcribiendo";
  }
  if (voiceState === "recording") {
    return "Escuchando";
  }
  return "Hablar";
}

function etiquetaVoz(
  voiceState: "idle" | "recording" | "transcribing",
  esEntrevista: boolean | undefined
) {
  if (voiceState === "recording") {
    return `Dejar de hablar (${etiquetaAtajoVoz()})`;
  }
  if (voiceState === "transcribing") {
    return "Transcribiendo...";
  }
  if (esEntrevista) {
    return `Hablar (${etiquetaAtajoVoz()})`;
  }
  return "Hablar";
}

function detenerPistas(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}

function mimeGrabacionVoz() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  const tipos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return tipos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? "";
}

function archivoVoz(blob: Blob, mime: string) {
  const esMp4 =
    mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac");
  const type = esMp4 ? "audio/mp4" : "audio/webm";
  const extension = esMp4 ? "m4a" : "webm";
  return new File([blob], `voice.${extension}`, { type });
}

function pedirDatosRecorder(recorder: MediaRecorder) {
  try {
    if (
      recorder.state === "recording" &&
      typeof recorder.requestData === "function"
    ) {
      recorder.requestData();
    }
  } catch {
    // Safari may throw if the recorder is already stopping.
  }
}

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureMultimodalInput({
  chatId,
  composerAction,
  demoAislada,
  demoVoz,
  esEntrevista,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  hayMensajeFallido = false,
  reintentarMensajeFallido,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  editingMessage,
  onCancelEdit,
  isLoading,
}: {
  chatId: string;
  composerAction?: ReactNode;
  demoAislada?: boolean;
  demoVoz?: ModoVozEntrevista;
  esEntrevista?: boolean;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  hayMensajeFallido?: boolean;
  reintentarMensajeFallido?: () => void;
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (esEntrevista) {
      return;
    }
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [esEntrevista, localStorageInput, setInput]);

  useEffect(() => {
    if (esEntrevista) {
      return;
    }
    setLocalStorageInput(input);
  }, [esEntrevista, input, setLocalStorageInput]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "transcribing"
  >("idle");
  const vozEntrevista = useEntrevistaVoz({
    demoVoz: esEntrevista ? demoVoz : undefined,
    setInput,
  });
  const handleEmpezarVozEntrevista = useCallback(() => {
    vozEntrevista.empezarGrabacion().catch(() => undefined);
  }, [vozEntrevista.empezarGrabacion]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const audioChunksRef = useRef<Blob[]>([]);
  const shortcutPressedRef = useRef(false);
  const voiceSessionRef = useRef(0);
  const voiceStateRef = useRef<"idle" | "recording" | "transcribing">("idle");
  const stopRequestedRef = useRef(false);

  const stopVoiceRecording = useCallback(() => {
    if (voiceStateRef.current !== "recording") {
      return;
    }
    stopRequestedRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    pedirDatosRecorder(recorder);
    try {
      recorder.stop();
    } catch {
      detenerPistas(mediaStreamRef.current);
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      voiceStateRef.current = "idle";
      setVoiceState("idle");
    }
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (voiceStateRef.current !== "idle") {
      return;
    }
    if (
      typeof MediaRecorder === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Este navegador no puede grabar audio");
      return;
    }
    stopRequestedRef.current = false;
    const session = voiceSessionRef.current + 1;
    voiceSessionRef.current = session;
    voiceStateRef.current = "recording";
    setVoiceState("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || voiceSessionRef.current !== session) {
        detenerPistas(stream);
        return;
      }
      mediaStreamRef.current = stream;
      const mimeType = mimeGrabacionVoz();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const tipoAudio = recorder.mimeType || mimeType || "audio/webm";
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      let cerrada = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const transcribir = async () => {
        if (
          cerrada ||
          !mountedRef.current ||
          voiceSessionRef.current !== session
        ) {
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          return;
        }
        cerrada = true;
        voiceStateRef.current = "transcribing";
        setVoiceState("transcribing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: tipoAudio });
          if (blob.size === 0) {
            throw new Error("No se capturó audio. Intenta de nuevo.");
          }
          const formData = new FormData();
          formData.append("audio", archivoVoz(blob, tipoAudio));
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/transcribe`,
            { body: formData, method: "POST" }
          );
          const json = (await response.json()) as {
            text?: string;
            error?: string;
          };
          if (!response.ok) {
            throw new Error(json.error ?? "Error al transcribir");
          }
          const text = (json.text ?? "").trim();
          if (text) {
            setInput((prev) => (prev ? `${prev.trim()} ${text}` : text));
            textareaRef.current?.focus();
          } else {
            toast.error("No se entendió el audio. Intenta de nuevo.");
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo transcribir"
          );
        } finally {
          if (voiceSessionRef.current === session) {
            voiceStateRef.current = "idle";
            setVoiceState("idle");
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      recorder.onerror = () => {
        cerrada = true;
        detenerPistas(stream);
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        if (voiceSessionRef.current === session) {
          toast.error("No se pudo grabar el audio");
          voiceStateRef.current = "idle";
          setVoiceState("idle");
        }
      };

      recorder.onstop = () => {
        detenerPistas(stream);
        mediaStreamRef.current = null;
        window.setTimeout(() => {
          transcribir().catch(() => undefined);
        }, 50);
      };

      const timeslice = tipoAudio.includes("webm") ? 250 : undefined;
      if (timeslice) {
        recorder.start(timeslice);
      } else {
        recorder.start();
      }
      if (stopRequestedRef.current && recorder.state === "recording") {
        pedirDatosRecorder(recorder);
        recorder.stop();
      }
    } catch {
      detenerPistas(mediaStreamRef.current);
      mediaStreamRef.current = null;
      if (voiceSessionRef.current === session) {
        toast.error("No se pudo acceder al micrófono");
        voiceStateRef.current = "idle";
        setVoiceState("idle");
      }
    }
  }, [setInput]);

  const toggleVoiceRecording = useCallback(() => {
    if (voiceStateRef.current === "recording") {
      stopVoiceRecording();
      return;
    }
    if (voiceStateRef.current === "idle") {
      startVoiceRecording().catch(() => undefined);
    }
  }, [startVoiceRecording, stopVoiceRecording]);

  useEffect(() => {
    if (!esEntrevista) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!esAtajoMicrófono(event) || event.repeat) {
        return;
      }
      event.preventDefault();
      if (
        shortcutPressedRef.current ||
        status !== "ready" ||
        vozEntrevista.estado === "transcribing" ||
        editingMessage
      ) {
        return;
      }
      shortcutPressedRef.current = true;
      if (vozEntrevista.estado === "recording") {
        vozEntrevista.detenerGrabacion();
        return;
      }
      vozEntrevista.empezarGrabacion().catch(() => undefined);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.code === "Space" ||
        event.key === "Alt" ||
        event.key === "AltGraph"
      ) {
        shortcutPressedRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    editingMessage,
    esEntrevista,
    status,
    vozEntrevista.detenerGrabacion,
    vozEntrevista.empezarGrabacion,
    vozEntrevista.estado,
  ]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      voiceSessionRef.current += 1;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      detenerPistas(mediaStreamRef.current);
      mediaStreamRef.current = null;
    },
    []
  );

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value;
      setInput(val);

      if (!esEntrevista && val.startsWith("/") && !val.includes(" ")) {
        setSlashOpen(true);
        setSlashQuery(val.slice(1));
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
      }
    },
    [esEntrevista, setInput]
  );

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);
      setInput("");
      switch (cmd.action) {
        case "new":
          router.push("/");
          break;
        case "clear":
          setMessages(() => []);
          break;
        case "rename":
          toast("Rename is available from the sidebar chat menu.");
          break;
        case "model": {
          const modelBtn = document.querySelector<HTMLButtonElement>(
            "[data-testid='model-selector']"
          );
          modelBtn?.click();
          break;
        }
        case "theme":
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          break;
        case "delete":
          toast("Delete this chat?", {
            action: {
              label: "Delete",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                  { method: "DELETE" }
                );
                router.push("/");
                toast.success("Chat deleted");
              },
            },
          });
          break;
        case "purge":
          toast("Delete all chats?", {
            action: {
              label: "Delete all",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`,
                  {
                    method: "DELETE",
                  }
                );
                router.push("/");
                toast.success("All chats deleted");
              },
            },
          });
          break;
        default:
          break;
      }
    },
    [chatId, resolvedTheme, router, setInput, setMessages, setTheme]
  );

  const submitForm = useCallback(() => {
    if (!esEntrevista) {
      window.history.pushState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
    }

    sendMessage({
      parts: [
        ...attachments.map((attachment) => ({
          mediaType: attachment.contentType,
          name: attachment.name,
          type: "file" as const,
          url: attachment.url,
        })),
        {
          text: input,
          type: "text",
        },
      ],
      role: "user",
    });

    setAttachments([]);
    setLocalStorageInput("");
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    esEntrevista,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        {
          body: formData,
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          contentType,
          name: pathname,
          url,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleCancelEditMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onCancelEdit?.();
    },
    [onCancelEdit]
  );

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
  }, []);

  const handlePromptSubmit = useCallback(() => {
    if (input.startsWith("/")) {
      const query = input.slice(1).trim();
      const cmd = slashCommands.find((c) => c.name === query);
      if (cmd) {
        handleSlashSelect(cmd);
      }
      return;
    }
    if (!input.trim() && attachments.length === 0) {
      return;
    }
    if (status === "ready" || status === "error") {
      submitForm();
    } else {
      toast.error("Please wait for the model to finish its response!");
    }
  }, [attachments.length, handleSlashSelect, input, status, submitForm]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashOpen) {
        const filtered = slashCommands.filter((cmd) =>
          cmd.name.startsWith(slashQuery.toLowerCase())
        );
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (filtered[slashIndex]) {
            handleSlashSelect(filtered[slashIndex]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (esAtajoMicrófono(e)) {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        e.preventDefault();
        onCancelEdit();
      }
    },
    [
      editingMessage,
      handleSlashSelect,
      onCancelEdit,
      slashIndex,
      slashOpen,
      slashQuery,
    ]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {editingMessage && onCancelEdit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>{esEntrevista ? "Editando mensaje" : "Editing message"}</span>
          <button
            className="rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            onMouseDown={handleCancelEditMouseDown}
            type="button"
          >
            {esEntrevista ? "Cancelar" : "Cancel"}
          </button>
        </div>
      ) : null}

      {!(editingMessage || isLoading || esEntrevista) &&
        messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {slashOpen ? (
          <SlashCommandMenu
            onClose={handleSlashClose}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        ) : null}
      </div>

      <PromptInput
        className={cn(
          esEntrevista
            ? "[&>div]:rounded-[1.25rem] [&>div]:border [&>div]:border-black/10 [&>div]:bg-white [&>div]:shadow-[0_1px_3px_rgba(15,23,42,0.06)] [&>div]:has-[textarea]:rounded-[1.25rem] [&>div]:has-data-[align=block-end]:rounded-[1.25rem]"
            : "[&>div]:rounded-2xl [&>div]:border [&>div]:border-border/30 [&>div]:bg-card/70 [&>div]:shadow-[var(--shadow-composer)] [&>div]:transition-shadow [&>div]:duration-300 [&>div]:focus-within:shadow-[var(--shadow-composer-focus)]"
        )}
        data-tour={esEntrevista ? "entrevista-hablar" : undefined}
        onSubmit={handlePromptSubmit}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <AttachmentPreviewItem
                attachment={attachment}
                fileInputRef={fileInputRef}
                key={attachment.url}
                setAttachments={setAttachments}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  contentType: "",
                  name: filename,
                  url: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <PromptInputTextarea
          className={cn(
            "px-4 pt-3.5 pb-1.5 placeholder:text-muted-foreground/35",
            esEntrevista
              ? "min-h-12 text-base leading-[1.7] md:text-[17px]"
              : "min-h-24 text-[13px] leading-relaxed"
          )}
          data-testid="multimodal-input"
          onChange={handleInput}
          onKeyDown={handleTextareaKeyDown}
          placeholder={placeholderTexto(esEntrevista, Boolean(editingMessage))}
          ref={textareaRef}
          value={input}
        />
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools
            className={
              esEntrevista && vozEntrevista.estado !== "idle"
                ? "min-w-0 flex-1"
                : undefined
            }
          >
            {esEntrevista ? null : (
              <AttachmentsButton
                fileInputRef={fileInputRef}
                selectedModelId={selectedModelId}
                status={status}
              />
            )}
            {esEntrevista ? (
              <EntrevistaVozCompositor
                avisoVoz={vozEntrevista.avisoVoz}
                cancelarGrabacion={vozEntrevista.cancelarGrabacion}
                canvasRef={vozEntrevista.canvasRef}
                detenerGrabacion={vozEntrevista.detenerGrabacion}
                duracionNodoRef={vozEntrevista.duracionNodoRef}
                empezarGrabacion={handleEmpezarVozEntrevista}
                errorVoz={vozEntrevista.errorVoz}
                estado={vozEntrevista.estado}
                microfonoEncendido={vozEntrevista.microfonoEncendido}
                soloCapturaLocal={vozEntrevista.soloCapturaLocal}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-keyshortcuts={esEntrevista ? "Alt+Space" : undefined}
                    aria-label={
                      demoAislada
                        ? "Hablar"
                        : etiquetaVoz(voiceState, esEntrevista)
                    }
                    aria-live="polite"
                    aria-pressed={voiceState === "recording"}
                    className={cn(
                      esEntrevista
                        ? "size-8 rounded-full p-0"
                        : "h-7 min-w-[8.25rem] gap-1.5 rounded-xl px-2.5 text-xs font-medium",
                      !esEntrevista &&
                        voiceState === "recording" &&
                        "voice-pulse-listening !border-red-500 !bg-red-500 !text-white hover:!bg-red-600 hover:!text-white",
                      !esEntrevista &&
                        voiceState === "transcribing" &&
                        "voice-pulse-transcribing !border-amber-500/80 !bg-amber-500/15 !text-amber-800 dark:!text-amber-200"
                    )}
                    disabled={
                      demoAislada ||
                      status !== "ready" ||
                      voiceState === "transcribing"
                    }
                    onClick={toggleVoiceRecording}
                    type="button"
                    variant="outline"
                  >
                    <MicIcon className="size-3.5" />
                    {esEntrevista ? null : (
                      <span
                        className={
                          voiceState === "idle" ? undefined : "animate-pulse"
                        }
                      >
                        {textoBotonVoz(voiceState)}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {etiquetaVoz(voiceState, esEntrevista)}
                </TooltipContent>
              </Tooltip>
            )}
            {esEntrevista ? null : (
              <ModelSelectorCompact
                onModelChange={onModelChange}
                selectedModelId={selectedModelId}
              />
            )}
          </PromptInputTools>

          <div className="flex items-center gap-2">
            {composerAction ? (
              <fieldset
                className="contents"
                disabled={voiceState !== "idle" || status !== "ready"}
              >
                {composerAction}
              </fieldset>
            ) : null}
            {hayMensajeFallido ? (
              <Button
                className="h-7 rounded-xl px-2.5 text-xs font-medium"
                data-testid="retry-send-button"
                onClick={reintentarMensajeFallido}
                type="button"
                variant="outline"
              >
                Reintentar envío
              </Button>
            ) : null}
            {status === "submitted" ? (
              <StopButton setMessages={setMessages} stop={stop} />
            ) : null}
            {status !== "submitted" &&
            !(esEntrevista && vozEntrevista.estado !== "idle") ? (
              <PromptInputSubmit
                aria-label="Enviar respuesta"
                className={cn(
                  esEntrevista
                    ? `${BOTON_ICONO_COMPOSITOR_ENTREVISTA} bg-neutral-900 p-0 text-white hover:bg-neutral-800`
                    : "h-7 w-7 rounded-xl transition-all duration-200",
                  input.trim()
                    ? esEntrevista
                      ? "opacity-100"
                      : "bg-foreground text-background hover:opacity-85 active:scale-95"
                    : esEntrevista
                      ? "bg-neutral-300 text-white"
                      : "bg-muted text-muted-foreground/25 cursor-not-allowed"
                )}
                data-testid="send-button"
                size={esEntrevista ? "sm" : "icon-sm"}
                disabled={
                  !input.trim() ||
                  uploadQueue.length > 0 ||
                  (Boolean(esEntrevista) && vozEntrevista.estado !== "idle")
                }
                status={status}
                variant={esEntrevista ? "default" : "secondary"}
              >
                <ArrowUpIcon className="size-4" />
              </PromptInputSubmit>
            ) : null}
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.editingMessage !== nextProps.editingMessage) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.esEntrevista !== nextProps.esEntrevista) {
      return false;
    }
    if (prevProps.demoAislada !== nextProps.demoAislada) {
      return false;
    }
    if (prevProps.demoVoz !== nextProps.demoVoz) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }
    if (prevProps.hayMensajeFallido !== nextProps.hayMensajeFallido) {
      return false;
    }

    return true;
  }
);

function PureAttachmentPreviewItem({
  attachment,
  fileInputRef,
  setAttachments,
}: {
  attachment: Attachment;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const handleRemove = useCallback(() => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((a) => a.url !== attachment.url)
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachment.url, fileInputRef, setAttachments]);

  return <PreviewAttachment attachment={attachment} onRemove={handleRemove} />;
}

const AttachmentPreviewItem = memo(PureAttachmentPreviewItem);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const { data: modelsResponse } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 3_600_000, revalidateOnFocus: false }
  );

  const caps: Record<string, ModelCapabilities> | undefined =
    modelsResponse?.capabilities ?? modelsResponse;
  const hasVision = caps?.[selectedModelId]?.vision ?? false;
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      fileInputRef.current?.click();
    },
    [fileInputRef]
  );

  return (
    <Button
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        hasVision
          ? "text-foreground hover:border-border hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed"
      )}
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={handleClick}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ height: 14, width: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function ModelSelectorOption({
  capabilities,
  curated,
  model,
  onModelChange,
  selectedModelId,
  setOpen,
}: {
  capabilities: Record<string, ModelCapabilities> | undefined;
  curated: boolean;
  model: ChatModel;
  onModelChange?: (modelId: string) => void;
  selectedModelId: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [logoProvider] = model.id.split("/");
  const maybeWithTooltip = (icon: ReactNode, label: string) => {
    if (!curated) {
      return icon;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };
  const handleSelect = useCallback(() => {
    if (!curated) {
      return;
    }
    onModelChange?.(model.id);
    setCookie("chat-model", model.id);
    setOpen(false);
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("[data-testid='multimodal-input']")
        ?.focus();
    }, 50);
  }, [curated, model.id, onModelChange, setOpen]);

  const option = (
    <ModelSelectorItem
      aria-disabled={!curated}
      className={cn(
        "flex w-full transition-colors",
        model.id === selectedModelId &&
          "border-b border-dashed border-foreground/50",
        curated
          ? "data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
          : "cursor-not-allowed opacity-40 data-[selected=true]:bg-transparent data-[selected=true]:opacity-60 data-[selected=true]:ring-1 data-[selected=true]:ring-muted-foreground/30 data-[selected=true]:ring-inset"
      )}
      onSelect={handleSelect}
      value={model.id}
    >
      <ModelSelectorLogo provider={logoProvider} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      <div className="ml-auto flex items-center gap-2 text-foreground/70">
        {capabilities?.[model.id]?.tools
          ? maybeWithTooltip(
              <WrenchIcon className="size-3.5" />,
              "Supports tool use"
            )
          : null}
        {capabilities?.[model.id]?.vision
          ? maybeWithTooltip(
              <EyeIcon className="size-3.5" />,
              "Supports vision"
            )
          : null}
        {capabilities?.[model.id]?.reasoning
          ? maybeWithTooltip(
              <BrainIcon className="size-3.5" />,
              "Supports reasoning"
            )
          : null}
        {!curated && <LockIcon className="size-3 text-muted-foreground/50" />}
      </div>
    </ModelSelectorItem>
  );

  if (curated) {
    return option;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full cursor-not-allowed">{option}</div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        This model is not available in the demo.
      </TooltipContent>
    </Tooltip>
  );
}

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 3_600_000, revalidateOnFocus: false }
  );

  const capabilities: Record<string, ModelCapabilities> | undefined =
    modelsData?.capabilities ?? modelsData;
  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? chatModels;

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === DEFAULT_CHAT_MODEL) ??
    activeModels[0];
  const [provider] = selectedModel.id.split("/");

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-7 max-w-[200px] justify-between gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          data-testid="model-selector"
          variant="ghost"
        >
          {provider ? <ModelSelectorLogo provider={provider} /> : null}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent commandDefaultValue={selectedModel.id}>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {(() => {
            const curatedIds = new Set(chatModels.map((m) => m.id));
            const allModels = dynamicModels
              ? [
                  ...chatModels,
                  ...dynamicModels.filter((m) => !curatedIds.has(m.id)),
                ]
              : chatModels;

            const grouped: Record<
              string,
              { model: ChatModel; curated: boolean }[]
            > = {};
            for (const model of allModels) {
              const key = curatedIds.has(model.id)
                ? "_available"
                : model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push({ curated: curatedIds.has(model.id), model });
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              if (a === "_available") {
                return -1;
              }
              if (b === "_available") {
                return 1;
              }
              return a.localeCompare(b);
            });

            const providerNames: Record<string, string> = {
              alibaba: "Alibaba",
              anthropic: "Anthropic",
              "arcee-ai": "Arcee AI",
              bytedance: "ByteDance",
              cohere: "Cohere",
              deepseek: "DeepSeek",
              google: "Google",
              inception: "Inception",
              kwaipilot: "Kwaipilot",
              meituan: "Meituan",
              meta: "Meta",
              minimax: "MiniMax",
              mistral: "Mistral",
              moonshotai: "Moonshot",
              morph: "Morph",
              nvidia: "Nvidia",
              openai: "OpenAI",
              perplexity: "Perplexity",
              "prime-intellect": "Prime Intellect",
              xai: "xAI",
              xiaomi: "Xiaomi",
              zai: "Zai",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup
                heading={
                  key === "_available"
                    ? "Available"
                    : (providerNames[key] ?? key)
                }
                key={key}
              >
                {grouped[key].map(({ model, curated }) => (
                  <ModelSelectorOption
                    capabilities={capabilities}
                    curated={curated}
                    key={model.id}
                    model={model}
                    onModelChange={onModelChange}
                    selectedModelId={selectedModel.id}
                    setOpen={setOpen}
                  />
                ))}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stop();
      setMessages((messages) => messages);
    },
    [setMessages, stop]
  );

  return (
    <Button
      className="h-7 w-7 rounded-xl bg-foreground p-1 text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/25 disabled:cursor-not-allowed"
      data-testid="stop-button"
      onClick={handleClick}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
