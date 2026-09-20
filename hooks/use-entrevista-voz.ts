"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  amplitudGuionSintetico,
  amplitudRmsSinContinua,
  avanzarHistorialOnda,
  clasificarErrorMicrofono,
  crearHistorialOnda,
  debeEnviarTranscripcion,
  esCapturaLocalSinEnvio,
  escalarAmplitudVisual,
  esGrabacionSimulada,
  formatearDuracionGrabacion,
  INTERVALO_MUESTRA_ONDA_MS,
  type ModoVozEntrevista,
  mensajeErrorMicrofono,
  pintarOndaEnCanvas,
  suavizarAmplitud,
  unirTextoTranscrito,
} from "@/lib/consultoria/entrevista-voz";

type EstadoVoz = "idle" | "recording" | "transcribing";

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

function detenerPistas(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
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

export function useEntrevistaVoz({
  demoVoz,
  setInput,
}: {
  demoVoz?: ModoVozEntrevista;
  setInput: Dispatch<SetStateAction<string>>;
}) {
  const [estado, setEstado] = useState<EstadoVoz>("idle");
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const [microfonoEncendido, setMicrofonoEncendido] = useState(false);
  const estadoRef = useRef<EstadoVoz>("idle");
  const sessionRef = useRef(0);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const descartarRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duracionNodoRef = useRef<HTMLSpanElement>(null);
  const historialRef = useRef(crearHistorialOnda());
  const suavizadoRef = useRef(0);
  const ultimoEmpujeRef = useRef(0);

  const setEstadoVoz = useCallback((siguiente: EstadoVoz) => {
    estadoRef.current = siguiente;
    setEstado(siguiente);
  }, []);

  const liberarCaptura = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const contexto = audioContextRef.current;
    audioContextRef.current = null;
    if (contexto) {
      contexto.close().catch(() => undefined);
    }
    detenerPistas(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    suavizadoRef.current = 0;
    historialRef.current = crearHistorialOnda();
    ultimoEmpujeRef.current = 0;
    setMicrofonoEncendido(false);
  }, []);

  const pintarFrame = useCallback((ahora: number, inicio: number) => {
    if (duracionNodoRef.current) {
      duracionNodoRef.current.textContent = formatearDuracionGrabacion(
        ahora - inicio
      );
    }
    pintarOndaEnCanvas(canvasRef.current, historialRef.current);
  }, []);

  const empujarAmplitud = useCallback((rms: number, ahora: number) => {
    suavizadoRef.current = suavizarAmplitud(suavizadoRef.current, rms);
    const visual = escalarAmplitudVisual(suavizadoRef.current);
    if (
      ultimoEmpujeRef.current === 0 ||
      ahora - ultimoEmpujeRef.current >= INTERVALO_MUESTRA_ONDA_MS
    ) {
      avanzarHistorialOnda(historialRef.current, visual);
      ultimoEmpujeRef.current = ahora;
    }
  }, []);

  const animarSintetico = useCallback(
    (inicio: number) => {
      const tick = (ahora: number) => {
        if (estadoRef.current !== "recording") {
          return;
        }
        empujarAmplitud(amplitudGuionSintetico(ahora - inicio), ahora);
        pintarFrame(ahora, inicio);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [empujarAmplitud, pintarFrame]
  );

  const animarAnalizador = useCallback(
    (analizador: AnalyserNode, inicio: number) => {
      const datos = new Float32Array(analizador.fftSize);
      const tick = (ahora: number) => {
        if (estadoRef.current !== "recording") {
          return;
        }
        analizador.getFloatTimeDomainData(datos);
        empujarAmplitud(amplitudRmsSinContinua(datos), ahora);
        pintarFrame(ahora, inicio);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [empujarAmplitud, pintarFrame]
  );

  const transcribir = useCallback(
    async (blob: Blob, tipoAudio: string, session: number) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      setEstadoVoz("transcribing");
      try {
        if (demoVoz === "fallo") {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 350);
          });
          throw new Error(
            "No se pudo transcribir. Tu texto escrito se conserva."
          );
        }

        if (esGrabacionSimulada(demoVoz)) {
          await new Promise((resolve, reject) => {
            const espera = window.setTimeout(resolve, 400);
            abort.signal.addEventListener("abort", () => {
              window.clearTimeout(espera);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
          if (!mountedRef.current || sessionRef.current !== session) {
            return;
          }
          setInput((previo) =>
            unirTextoTranscrito(previo, "Esto es una transcripción simulada.")
          );
          return;
        }

        if (blob.size === 0) {
          throw new Error("No se capturó audio. Intenta de nuevo.");
        }

        const formData = new FormData();
        formData.append("audio", archivoVoz(blob, tipoAudio));
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/transcribe`,
          { body: formData, method: "POST", signal: abort.signal }
        );
        const cuerpo = await response.text();
        let json: { error?: string; text?: string } = {};
        try {
          json = JSON.parse(cuerpo) as { error?: string; text?: string };
        } catch (error) {
          throw new Error(
            "No se pudo transcribir. Tu texto escrito se conserva.",
            { cause: error }
          );
        }
        if (!response.ok) {
          throw new Error(
            json.error ??
              "No se pudo transcribir. Tu texto escrito se conserva."
          );
        }
        const text = (json.text ?? "").trim();
        if (!text) {
          toast.error("No se entendió el audio. Intenta de nuevo.");
          return;
        }
        setInput((previo) => unirTextoTranscrito(previo, text));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const mensaje =
          error instanceof Error
            ? error.message
            : "No se pudo transcribir. Tu texto escrito se conserva.";
        setErrorVoz(mensaje);
        toast.error(mensaje);
      } finally {
        if (sessionRef.current === session && mountedRef.current) {
          setEstadoVoz("idle");
        }
      }
    },
    [demoVoz, setEstadoVoz, setInput]
  );

  const cancelarGrabacion = useCallback(() => {
    if (estadoRef.current !== "recording") {
      return;
    }
    descartarRef.current = true;
    sessionRef.current += 1;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Already stopping.
      }
    }
    liberarCaptura();
    if (esCapturaLocalSinEnvio(demoVoz)) {
      setAvisoVoz("Grabación descartada. Micrófono apagado.");
    }
    setEstadoVoz("idle");
  }, [demoVoz, liberarCaptura, setEstadoVoz]);

  const detenerGrabacion = useCallback(() => {
    if (estadoRef.current !== "recording") {
      return;
    }
    descartarRef.current = false;
    if (esCapturaLocalSinEnvio(demoVoz)) {
      liberarCaptura();
      setAvisoVoz("Micrófono apagado. El audio no se envió.");
      setEstadoVoz("idle");
      return;
    }
    if (esGrabacionSimulada(demoVoz)) {
      const session = sessionRef.current;
      liberarCaptura();
      transcribir(new Blob(), "audio/webm", session).catch(() => undefined);
      return;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    pedirDatosRecorder(recorder);
    try {
      recorder.stop();
    } catch {
      liberarCaptura();
      setEstadoVoz("idle");
    }
  }, [demoVoz, liberarCaptura, setEstadoVoz, transcribir]);

  const empezarGrabacion = useCallback(async () => {
    if (estadoRef.current !== "idle") {
      return;
    }
    if (demoVoz === "denegado") {
      const mensaje = mensajeErrorMicrofono("denegado");
      setErrorVoz(mensaje);
      toast.error(mensaje);
      return;
    }
    if (demoVoz === "sin-mic") {
      const mensaje = mensajeErrorMicrofono("sin-mic");
      setErrorVoz(mensaje);
      toast.error(mensaje);
      return;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    descartarRef.current = false;
    startedAtRef.current = performance.now();
    historialRef.current = crearHistorialOnda();
    suavizadoRef.current = 0;
    ultimoEmpujeRef.current = 0;
    if (duracionNodoRef.current) {
      duracionNodoRef.current.textContent = "0:00";
    }
    setErrorVoz(null);
    setAvisoVoz(null);
    setEstadoVoz("recording");

    if (esGrabacionSimulada(demoVoz)) {
      animarSintetico(startedAtRef.current);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      const mensaje = mensajeErrorMicrofono("sin-mic");
      setErrorVoz(mensaje);
      toast.error(mensaje);
      setEstadoVoz("idle");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || sessionRef.current !== session) {
        detenerPistas(stream);
        return;
      }
      streamRef.current = stream;
      setMicrofonoEncendido(true);

      const contexto = new AudioContext();
      audioContextRef.current = contexto;
      if (contexto.state === "suspended") {
        await contexto.resume();
      }
      if (!mountedRef.current || sessionRef.current !== session) {
        liberarCaptura();
        return;
      }
      const fuente = contexto.createMediaStreamSource(stream);
      const analizador = contexto.createAnalyser();
      analizador.fftSize = 2048;
      analizador.smoothingTimeConstant = 0;
      fuente.connect(analizador);
      animarAnalizador(analizador, startedAtRef.current);

      if (esCapturaLocalSinEnvio(demoVoz)) {
        return;
      }

      if (typeof MediaRecorder === "undefined") {
        liberarCaptura();
        const mensaje = mensajeErrorMicrofono("sin-mic");
        setErrorVoz(mensaje);
        toast.error(mensaje);
        setEstadoVoz("idle");
        return;
      }

      const mimeType = mimeGrabacionVoz();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const tipoAudio = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) {
          return;
        }
        liberarCaptura();
        const mensaje = "No se pudo grabar el audio";
        setErrorVoz(mensaje);
        toast.error(mensaje);
        setEstadoVoz("idle");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: tipoAudio });
        liberarCaptura();
        if (
          descartarRef.current ||
          sessionRef.current !== session ||
          !debeEnviarTranscripcion(demoVoz)
        ) {
          return;
        }
        transcribir(blob, tipoAudio, session).catch(() => undefined);
      };

      const timeslice = tipoAudio.includes("webm") ? 250 : undefined;
      if (timeslice) {
        recorder.start(timeslice);
      } else {
        recorder.start();
      }
    } catch (error) {
      liberarCaptura();
      const mensaje = mensajeErrorMicrofono(clasificarErrorMicrofono(error));
      setErrorVoz(mensaje);
      toast.error(mensaje);
      setEstadoVoz("idle");
    }
  }, [
    animarAnalizador,
    animarSintetico,
    demoVoz,
    liberarCaptura,
    setEstadoVoz,
    transcribir,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      abortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Already stopping.
        }
      }
      liberarCaptura();
    };
  }, [liberarCaptura]);

  return {
    avisoVoz,
    cancelarGrabacion,
    canvasRef,
    detenerGrabacion,
    duracionNodoRef,
    empezarGrabacion,
    errorVoz,
    estado,
    microfonoEncendido,
    soloCapturaLocal: esCapturaLocalSinEnvio(demoVoz),
  };
}
