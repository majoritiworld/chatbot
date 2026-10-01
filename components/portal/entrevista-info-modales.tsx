"use client";

import {
  BotIcon,
  ClockIcon,
  FlaskConicalIcon,
  InfoIcon,
  ListChecksIcon,
  LockIcon,
  MailIcon,
  PencilLineIcon,
  SaveIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMarcaParticipante } from "@/components/portal/marca-participante";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  BloqueInformativo,
  IconoBloque,
  InicioEnChat,
} from "@/lib/consultoria/inicio-en-chat";

const ICONOS: Record<IconoBloque, ComponentType<{ className?: string }>> = {
  asistente: BotIcon,
  corregir: PencilLineIcon,
  demo: FlaskConicalIcon,
  guardado: SaveIcon,
  nombre: UserRoundIcon,
  pauta: ListChecksIcon,
  pendiente: ClockIcon,
  personas: UsersRoundIcon,
};

function Bloques({
  bloques,
  contacto,
}: {
  bloques: BloqueInformativo[];
  contacto?: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border/70">
      {bloques.map((bloque) => {
        const Icono = ICONOS[bloque.icono ?? "asistente"];
        return (
          <li
            className="flex flex-col gap-1.5 py-4 first:pt-0"
            key={bloque.titulo}
          >
            <Icono className="size-[18px] text-neutral-800" />
            <p className="font-medium text-[15px] text-neutral-900">
              {bloque.titulo}
              {bloque.pendiente ? (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle font-normal text-[11px] text-amber-800">
                  Pendiente para el piloto
                </span>
              ) : null}
            </p>
            <p className="text-[14px] text-neutral-600 leading-relaxed">
              {bloque.texto}
            </p>
          </li>
        );
      })}
      {contacto ? (
        <li className="flex flex-col gap-1.5 py-4 last:pb-0">
          <MailIcon className="size-[18px] text-neutral-800" />
          <p className="font-medium text-[15px] text-neutral-900">¿Dudas?</p>
          <p className="break-words text-[14px] text-neutral-600 leading-relaxed">
            {contacto}
          </p>
        </li>
      ) : null}
    </ul>
  );
}

function Modal({
  bloques,
  contacto,
  descripcion,
  Icono,
  testId,
  titulo,
}: {
  bloques: BloqueInformativo[];
  contacto?: string | null;
  descripcion: string;
  Icono: ComponentType<{ className?: string }>;
  testId: string;
  titulo: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-[12px] text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`${testId}-abrir`}
          type="button"
        >
          <Icono className="size-3.5" />
          {titulo}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[min(85dvh,640px)] gap-5 overflow-y-auto rounded-[28px] bg-white p-7 sm:max-w-[420px]"
        closeLabel="Cerrar"
        data-testid={testId}
        overlayClassName="bg-neutral-900/20 backdrop-blur-sm"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-center font-semibold text-[15px]">
            {titulo}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {descripcion}
          </DialogDescription>
        </DialogHeader>
        <Bloques bloques={bloques} contacto={contacto} />
      </DialogContent>
    </Dialog>
  );
}

export function EntrevistaInfoModales({ inicio }: { inicio: InicioEnChat }) {
  const marca = useMarcaParticipante();
  let contacto: string | null = null;
  if (marca.contactoEmail) {
    contacto = marca.contactoNombre
      ? `${marca.contactoNombre}: ${marca.contactoEmail}`
      : marca.contactoEmail;
  }

  return (
    <nav
      aria-label="Información de la entrevista"
      className="flex items-center justify-center gap-2 pt-1"
    >
      <Modal
        bloques={inicio.privacidad}
        contacto={contacto}
        descripcion="Quién ve tus respuestas y qué se guarda."
        Icono={LockIcon}
        testId="modal-privacidad"
        titulo="Tu privacidad"
      />
      <span aria-hidden="true" className="text-[12px] text-neutral-300">
        ·
      </span>
      <Modal
        bloques={inicio.ia}
        descripcion="Cómo conduce la conversación el asistente de IA."
        Icono={InfoIcon}
        testId="modal-ia"
        titulo="Cómo funciona la IA"
      />
    </nav>
  );
}
