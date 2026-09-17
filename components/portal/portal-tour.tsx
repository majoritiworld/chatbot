"use client";

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Rect = {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
};

type Preferencia = "center" | "left" | "right" | "bottom";

type Paso = {
  descripcion: string;
  descripcionSinCta?: string;
  id: string;
  prefer: Preferencia;
  selector: string | null;
  titulo: string;
};

const PASOS: Paso[] = [
  {
    descripcion:
      "Te invitamos a un recorrido corto para conocer cómo está organizado tu proyecto: las fases, el calendario y tu entrevista.",
    id: "invitar",
    prefer: "center",
    selector: null,
    titulo: "¿Te mostramos el portal?",
  },
  {
    descripcion:
      "El proyecto avanza por fases. Aquí ves en cuál están, las fechas previstas y las entrevistas o tareas de cada una.",
    id: "fases",
    prefer: "right",
    selector: '[data-tour="fases"]',
    titulo: "Las fases",
  },
  {
    descripcion:
      "Estas son las fechas relevantes del proyecto: reuniones, entregas y otros hitos, con quién participa en cada una.",
    id: "calendario",
    prefer: "left",
    selector: '[data-tour="calendario"]',
    titulo: "El calendario",
  },
  {
    descripcion:
      "Esta es tu entrevista. Te señalamos el botón para empezarla. Puedes pausar y continuar cuando quieras.",
    descripcionSinCta:
      "Esta es tu entrevista. Cuando la fase esté en curso, podrás abrirla desde aquí.",
    id: "entrevista",
    prefer: "left",
    selector: '[data-tour="entrevista"]',
    titulo: "Tu entrevista",
  },
];

const CLAVE_TOUR = "mj-portal-tour";
const MARGEN = 16;
const HUECO_PAD = 8;
const TARJETA_GAP = 16;

function claveTour(userId: string) {
  return `${CLAVE_TOUR}:${userId}`;
}

function tourYaVisto(userId: string) {
  try {
    return window.localStorage.getItem(claveTour(userId)) !== null;
  } catch {
    return true;
  }
}

function marcarTourVisto(userId: string) {
  try {
    window.localStorage.setItem(claveTour(userId), "1");
  } catch {
    // Storage can be blocked; the tour simply may reappear.
  }
}

function clamp(n: number, min: number, max: number) {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

function radioHueco(el: HTMLElement) {
  const computed = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  if (Number.isNaN(computed)) {
    return HUECO_PAD;
  }
  return computed + HUECO_PAD;
}

function rectDeTarget(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = clamp(r.top - HUECO_PAD, MARGEN, vh - MARGEN);
  const left = clamp(r.left - HUECO_PAD, MARGEN, vw - MARGEN);
  const bottom = clamp(r.bottom + HUECO_PAD, MARGEN, vh - MARGEN);
  const right = clamp(r.right + HUECO_PAD, MARGEN, vw - MARGEN);

  return {
    height: Math.max(0, bottom - top),
    left,
    radius: radioHueco(el),
    top,
    width: Math.max(0, right - left),
  };
}

function cabeEnViewport(
  pos: { left: number; top: number },
  card: { height: number; width: number }
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    pos.top >= MARGEN &&
    pos.left >= MARGEN &&
    pos.top + card.height <= vh - MARGEN &&
    pos.left + card.width <= vw - MARGEN
  );
}

function posicionTarjeta(
  highlight: Rect,
  card: { height: number; width: number },
  prefer: Preferencia
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftAligned = clamp(highlight.left, MARGEN, vw - card.width - MARGEN);
  const topAligned = clamp(highlight.top, MARGEN, vh - card.height - MARGEN);
  const abajo = {
    left: leftAligned,
    top: highlight.top + highlight.height + TARJETA_GAP,
  };
  const arriba = {
    left: leftAligned,
    top: highlight.top - TARJETA_GAP - card.height,
  };
  const derecha = {
    left: highlight.left + highlight.width + TARJETA_GAP,
    top: topAligned,
  };
  const izquierda = {
    left: highlight.left - TARJETA_GAP - card.width,
    top: topAligned,
  };

  let orden = [abajo, arriba, derecha, izquierda];
  if (prefer === "left") {
    orden = [izquierda, abajo, arriba, derecha];
  } else if (prefer === "right") {
    orden = [derecha, abajo, arriba, izquierda];
  }

  for (const pos of orden) {
    if (cabeEnViewport(pos, card)) {
      return pos;
    }
  }

  return {
    left: leftAligned,
    top: clamp(abajo.top, MARGEN, Math.max(MARGEN, vh - card.height - MARGEN)),
  };
}

function targetEsBoton(el: Element) {
  return el.matches("a, button") || Boolean(el.closest("a, button"));
}

function TourCapa({ hueco }: { hueco: Rect | null }) {
  if (!hueco) {
    return (
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/70" />
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed top-0 right-0 left-0 z-50"
        style={{ height: hueco.top }}
      />
      <div
        aria-hidden="true"
        className="fixed right-0 bottom-0 left-0 z-50"
        style={{ top: hueco.top + hueco.height }}
      />
      <div
        aria-hidden="true"
        className="fixed z-50"
        style={{
          height: hueco.height,
          left: 0,
          top: hueco.top,
          width: hueco.left,
        }}
      />
      <div
        aria-hidden="true"
        className="fixed z-50"
        style={{
          height: hueco.height,
          left: hueco.left + hueco.width,
          right: 0,
          top: hueco.top,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      >
        <div
          className="absolute"
          style={{
            borderRadius: hueco.radius,
            boxShadow:
              "0 0 0 2px var(--background), 0 0 0 9999px rgb(0 0 0 / 0.7)",
            height: hueco.height,
            left: hueco.left,
            top: hueco.top,
            width: hueco.width,
          }}
        />
      </div>
    </>
  );
}

function TourTarjeta({
  descripcion,
  esInvitacion,
  esUltimo,
  onSaltar,
  onSiguiente,
  pasoId,
  primarioRef,
  spotlightIds,
  style,
  tarjetaRef,
  titulo,
}: {
  descripcion: string;
  esInvitacion: boolean;
  esUltimo: boolean;
  onSaltar: () => void;
  onSiguiente: () => void;
  pasoId: string;
  primarioRef: RefObject<HTMLButtonElement | null>;
  spotlightIds: string[];
  style: CSSProperties;
  tarjetaRef: RefObject<HTMLDivElement | null>;
  titulo: string;
}) {
  let cta = "Siguiente";
  if (esInvitacion) {
    cta = "Hacer el tour";
  } else if (esUltimo) {
    cta = "Listo";
  }
  const secundario = esInvitacion ? "Ahora no" : "Saltar";

  return (
    <div
      aria-describedby="portal-tour-desc"
      aria-labelledby="portal-tour-title"
      aria-modal="true"
      className={cn(
        "fixed z-[60] flex flex-col gap-4 bg-background p-5 text-sm shadow-[var(--shadow-float)] ring-1 ring-foreground/10 outline-none animate-in fade-in-0 zoom-in-95",
        esInvitacion
          ? "w-[min(100%-2rem,28rem)] rounded-4xl p-6"
          : "w-80 rounded-2xl"
      )}
      ref={tarjetaRef}
      role="dialog"
      style={style}
      tabIndex={-1}
    >
      <div className="flex flex-col gap-2">
        {esInvitacion ? null : (
          <div aria-hidden="true" className="flex gap-1.5">
            {spotlightIds.map((id) => (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  id === pasoId ? "bg-foreground" : "bg-muted-foreground/30"
                )}
                key={id}
              />
            ))}
          </div>
        )}
        <h2 className="font-medium text-base" id="portal-tour-title">
          {titulo}
        </h2>
        <p className="text-muted-foreground" id="portal-tour-desc">
          {descripcion}
        </p>
        {esInvitacion ? null : (
          <p className="sr-only">
            Paso {spotlightIds.indexOf(pasoId) + 1} de {spotlightIds.length}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex gap-2",
          esInvitacion ? "flex-col-reverse sm:flex-row sm:justify-end" : null
        )}
      >
        <Button onClick={onSaltar} type="button" variant="outline">
          {secundario}
        </Button>
        <Button onClick={onSiguiente} ref={primarioRef} type="button">
          {cta}
        </Button>
      </div>
    </div>
  );
}

export function PortalTour({
  habilitado,
  userId,
}: {
  habilitado: boolean;
  userId: string;
}) {
  const [pasos, setPasos] = useState<Paso[]>(PASOS);
  const [visible, setVisible] = useState(false);
  const [indice, setIndice] = useState(0);
  const [hueco, setHueco] = useState<Rect | null>(null);
  const [posTarjeta, setPosTarjeta] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [usaCta, setUsaCta] = useState(true);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const primarioRef = useRef<HTMLButtonElement>(null);
  const paso = pasos.at(indice) ?? null;

  const completar = useCallback(() => {
    marcarTourVisto(userId);
    setVisible(false);
  }, [userId]);

  const avanzar = useCallback(() => {
    if (indice >= pasos.length - 1) {
      completar();
      return;
    }
    setPosTarjeta(null);
    setIndice((actual) => actual + 1);
  }, [completar, indice, pasos.length]);

  useEffect(() => {
    if (!habilitado || tourYaVisto(userId)) {
      return;
    }
    setPasos(
      PASOS.filter(
        (item) => !item.selector || document.querySelector(item.selector)
      )
    );
    setIndice(0);
    setVisible(true);
  }, [habilitado, userId]);

  useEffect(() => {
    if (!(visible && paso)) {
      return;
    }

    if (!paso.selector) {
      setHueco(null);
      setPosTarjeta(null);
      setUsaCta(true);
      return;
    }

    const el = document.querySelector<HTMLElement>(paso.selector);
    if (!el) {
      setHueco(null);
      return;
    }

    setUsaCta(targetEsBoton(el));
    const reducir = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollIntoView({
      behavior: reducir ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });

    const medir = () => {
      setHueco(rectDeTarget(el));
    };
    medir();
    const espera = window.setTimeout(medir, reducir ? 0 : 350);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [paso, visible]);

  useEffect(() => {
    if (!(visible && paso) || paso.prefer === "center") {
      return;
    }
    if (!(hueco && tarjetaRef.current)) {
      return;
    }
    setPosTarjeta(
      posicionTarjeta(
        hueco,
        {
          height: tarjetaRef.current.offsetHeight,
          width: tarjetaRef.current.offsetWidth,
        },
        paso.prefer
      )
    );
  }, [hueco, paso, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const id = paso?.id;
    if (!id) {
      return;
    }
    primarioRef.current?.focus();
  }, [paso?.id, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        completar();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const nodo = tarjetaRef.current;
      if (!nodo) {
        return;
      }
      const botones = [...nodo.querySelectorAll("button")];
      const primero = botones.at(0);
      const ultimo = botones.at(-1);
      if (!(primero && ultimo)) {
        return;
      }
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [completar, visible]);

  if (!(visible && paso)) {
    return null;
  }

  const esInvitacion = paso.prefer === "center";
  const esUltimo = indice >= pasos.length - 1;
  let { descripcion } = paso;
  if (paso.descripcionSinCta && !usaCta) {
    descripcion = paso.descripcionSinCta;
  }
  let style: CSSProperties = {
    left: MARGEN,
    top: MARGEN,
    visibility: "hidden",
  };
  if (esInvitacion) {
    style = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else if (posTarjeta) {
    style = { left: posTarjeta.left, top: posTarjeta.top };
  }

  return createPortal(
    <>
      <TourCapa hueco={hueco} />
      <TourTarjeta
        descripcion={descripcion}
        esInvitacion={esInvitacion}
        esUltimo={esUltimo}
        onSaltar={completar}
        onSiguiente={avanzar}
        pasoId={paso.id}
        primarioRef={primarioRef}
        spotlightIds={pasos
          .filter((item) => item.selector)
          .map((item) => item.id)}
        style={style}
        tarjetaRef={tarjetaRef}
        titulo={paso.titulo}
      />
    </>,
    document.body
  );
}
