"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ConduccionEntrevista,
  MAX_SEGUIMIENTOS,
  type SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  ETIQUETA_ESTADO,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const PLACEHOLDER_PREGUNTAS = `¿Cuáles son los principales retos del área hoy?
¿Qué decisiones se toman sin datos suficientes?
¿Qué cambiarías primero si pudieras?`;

/** Interviewing on a blocked phase is pointless: that phase opens on assign. */
export function faseSugerida(fases: FaseAdmin[]): string {
  const abierta = fases.find(
    (fase) => normalizarEstado(fase.estado) === "en_progreso"
  );

  return abierta?.id ?? fases[0]?.id ?? "";
}

export function FaseSelect({
  id,
  fases,
  defaultValue,
}: {
  id: string;
  fases: FaseAdmin[];
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Fase</Label>
      <select
        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        defaultValue={defaultValue ?? faseSugerida(fases)}
        id={id}
        name="faseId"
        required
      >
        {fases.map((fase) => (
          <option key={fase.id} value={fase.id}>
            {fase.orden}. {fase.nombre} (
            {ETIQUETA_ESTADO[normalizarEstado(fase.estado)]})
          </option>
        ))}
      </select>
    </div>
  );
}

export function PreguntasField({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Preguntas guía</Label>
      <Textarea
        className="min-h-28 text-sm"
        defaultValue={defaultValue}
        id={id}
        name="preguntas"
        placeholder={PLACEHOLDER_PREGUNTAS}
        required
      />
      <p className="text-muted-foreground text-xs">
        Una por línea. El entrevistador de IA las usa como temas a cubrir, no
        las lee tal cual.
      </p>
    </div>
  );
}

const SECCION_INICIAL: SeccionEntrevista = {
  descripcion: "",
  id: "new-initial",
  preguntas: [],
  titulo: "",
};

function nuevaSeccion(): SeccionEntrevista {
  return {
    descripcion: "",
    id: crypto.randomUUID(),
    preguntas: [],
    titulo: "",
  };
}

type CampoSeccion =
  | "titulo"
  | "descripcion"
  | "preguntas"
  | "instrucciones"
  | "seguimientos";

function SeccionEditor({
  indice,
  numeroSecciones,
  onActualizar,
  onEliminar,
  onMover,
  seccion,
}: {
  indice: number;
  numeroSecciones: number;
  onActualizar: (id: string, campo: CampoSeccion, valor: string) => void;
  onEliminar: (id: string) => void;
  onMover: (indice: number, direccion: -1 | 1) => void;
  seccion: SeccionEntrevista;
}) {
  const prefijo = `seccion-${seccion.id}`;
  const handleSubir = useCallback(() => onMover(indice, -1), [indice, onMover]);
  const handleBajar = useCallback(() => onMover(indice, 1), [indice, onMover]);
  const handleEliminar = useCallback(
    () => onEliminar(seccion.id),
    [onEliminar, seccion.id]
  );
  const handleTitulo = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onActualizar(seccion.id, "titulo", event.target.value),
    [onActualizar, seccion.id]
  );
  const handleDescripcion = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      onActualizar(seccion.id, "descripcion", event.target.value),
    [onActualizar, seccion.id]
  );
  const handlePreguntas = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      onActualizar(seccion.id, "preguntas", event.target.value),
    [onActualizar, seccion.id]
  );
  const handleInstrucciones = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      onActualizar(seccion.id, "instrucciones", event.target.value),
    [onActualizar, seccion.id]
  );
  const handleSeguimientos = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      onActualizar(seccion.id, "seguimientos", event.target.value),
    [onActualizar, seccion.id]
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">Sección {indice + 1}</p>
        <div className="flex items-center gap-1">
          <Button
            aria-label={`Subir sección ${indice + 1}`}
            disabled={indice === 0}
            onClick={handleSubir}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ArrowUpIcon />
          </Button>
          <Button
            aria-label={`Bajar sección ${indice + 1}`}
            disabled={indice === numeroSecciones - 1}
            onClick={handleBajar}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ArrowDownIcon />
          </Button>
          <Button
            aria-label={`Eliminar sección ${indice + 1}`}
            disabled={numeroSecciones === 1}
            onClick={handleEliminar}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijo}-titulo`}>Título</Label>
        <Input
          id={`${prefijo}-titulo`}
          onChange={handleTitulo}
          placeholder="Contexto y desafíos actuales"
          required
          value={seccion.titulo}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijo}-descripcion`}>
          Descripción pública (la ve el participante)
        </Label>
        <Textarea
          id={`${prefijo}-descripcion`}
          onChange={handleDescripcion}
          placeholder="Qué conversaremos en esta sección."
          value={seccion.descripcion}
        />
        <p className="text-muted-foreground text-xs">
          Introducción breve al tema. Nunca reglas del agente ni seguimientos.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-dashed p-3">
        <p className="font-medium text-muted-foreground text-xs">
          Solo para el agente. El participante no ve esta parte.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefijo}-preguntas`}>
            Pregunta principal o preguntas guía
          </Label>
          <Textarea
            id={`${prefijo}-preguntas`}
            onChange={handlePreguntas}
            placeholder={PLACEHOLDER_PREGUNTAS}
            required
            value={seccion.preguntas.join("\n")}
          />
          <p className="text-muted-foreground text-xs">
            Una por línea. Con seguimientos opcionales, deja solo la pregunta
            principal: el agente la hace primero. Sin seguimientos, cada línea
            es un tema que el agente debe cubrir.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefijo}-instrucciones`}>
            Instrucciones internas de la sección
          </Label>
          <Textarea
            id={`${prefijo}-instrucciones`}
            onChange={handleInstrucciones}
            placeholder="Prioridades de esta sección, texto de apertura o de cierre."
            value={seccion.instrucciones ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefijo}-seguimientos`}>
            Seguimientos opcionales
          </Label>
          <Textarea
            id={`${prefijo}-seguimientos`}
            onChange={handleSeguimientos}
            placeholder="Si no menciona resultados concretos: ¿Recuerda alguna situación…?"
            value={(seccion.seguimientos ?? []).join("\n")}
          />
          <p className="text-muted-foreground text-xs">
            Uno por línea, con su condición antes de los dos puntos. Es un menú:
            el agente usa como máximo{" "}
            {seccion.maxSeguimientos ?? MAX_SEGUIMIENTOS} por sección, de a uno,
            y solo si hacen falta.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SeccionesField({
  defaultValue = [],
}: {
  defaultValue?: SeccionEntrevista[];
}) {
  const [secciones, setSecciones] = useState<SeccionEntrevista[]>(
    defaultValue.length > 0 ? defaultValue : [SECCION_INICIAL]
  );

  const actualizar = useCallback(
    (id: string, campo: CampoSeccion, valor: string) => {
      setSecciones((previas) =>
        previas.map((seccion) => {
          if (seccion.id !== id) {
            return seccion;
          }
          if (campo === "preguntas" || campo === "seguimientos") {
            return {
              ...seccion,
              [campo]: valor.split("\n"),
            };
          }
          return { ...seccion, [campo]: valor };
        })
      );
    },
    []
  );

  const mover = useCallback((indice: number, direccion: -1 | 1) => {
    setSecciones((previas) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= previas.length) {
        return previas;
      }
      const siguientes = [...previas];
      const actual = siguientes.at(indice);
      const reemplazo = siguientes.at(destino);
      if (!(actual && reemplazo)) {
        return previas;
      }
      siguientes[indice] = reemplazo;
      siguientes[destino] = actual;
      return siguientes;
    });
  }, []);

  const eliminar = useCallback((id: string) => {
    setSecciones((previas) => previas.filter((seccion) => seccion.id !== id));
  }, []);

  const agregar = useCallback(() => {
    setSecciones((previas) => [...previas, nuevaSeccion()]);
  }, []);

  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="font-medium text-sm">Secciones</legend>
        <p className="text-muted-foreground text-xs">
          Cada sección tiene una descripción pública y una parte que solo recibe
          el agente.
        </p>
      </div>

      <input name="secciones" type="hidden" value={JSON.stringify(secciones)} />

      {secciones.map((seccion, indice) => (
        <SeccionEditor
          indice={indice}
          key={seccion.id}
          numeroSecciones={secciones.length}
          onActualizar={actualizar}
          onEliminar={eliminar}
          onMover={mover}
          seccion={seccion}
        />
      ))}

      <Button
        className="w-fit"
        onClick={agregar}
        type="button"
        variant="outline"
      >
        <PlusIcon />
        Agregar sección
      </Button>
    </fieldset>
  );
}

export function ConduccionField({
  defaultValue,
}: {
  defaultValue?: ConduccionEntrevista;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <div>
        <legend className="font-medium text-sm">
          Conducción del agente (común a todas las secciones)
        </legend>
        <p className="text-muted-foreground text-xs">
          Solo para el agente. El participante no ve esta parte.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conduccion-trato">Trato</Label>
        <select
          className="h-9 w-fit rounded-lg border border-input bg-transparent px-3 text-sm"
          defaultValue={defaultValue?.trato ?? "tu"}
          id="conduccion-trato"
          name="trato"
        >
          <option value="tu">Tú</option>
          <option value="usted">Usted</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conduccion-instrucciones">
          Instrucciones internas de la entrevista
        </Label>
        <Textarea
          className="min-h-24 text-sm"
          defaultValue={defaultValue?.instruccionesAgente ?? ""}
          id="conduccion-instrucciones"
          name="instruccionesAgente"
          placeholder="Reglas de conducción comunes a todas las secciones."
        />
      </div>
    </fieldset>
  );
}
