"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
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

type CampoSeccion = "titulo" | "descripcion" | "preguntas";

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
        <Label htmlFor={`${prefijo}-descripcion`}>Descripción</Label>
        <Textarea
          id={`${prefijo}-descripcion`}
          onChange={handleDescripcion}
          placeholder="Qué conversaremos en esta sección."
          value={seccion.descripcion}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijo}-preguntas`}>Preguntas guía</Label>
        <Textarea
          id={`${prefijo}-preguntas`}
          onChange={handlePreguntas}
          placeholder={PLACEHOLDER_PREGUNTAS}
          required
          value={seccion.preguntas.join("\n")}
        />
        <p className="text-muted-foreground text-xs">Una por línea.</p>
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
          if (campo === "preguntas") {
            return {
              ...seccion,
              preguntas: valor.split("\n"),
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
          Cada sección presenta un tema y contiene sus preguntas guía.
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
