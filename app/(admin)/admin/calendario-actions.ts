"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/(admin)/admin/actions";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { agregarEventosDeGoogle } from "@/lib/consultoria/eventos";
import {
  desconectarCalendarioDe,
  listarEventosGoogle,
  obtenerEventoGoogle,
  tokenDeCalendario,
} from "@/lib/consultoria/google-calendar";

const importarSchema = z.object({
  googleEventId: z.string().trim().min(1).max(1024),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

const serieSchema = z.object({
  proyectoId: z.string().uuid("Proyecto inválido"),
  serieId: z.string().trim().min(1).max(1024),
});

const desconectarSchema = z.object({
  proyectoId: z.string().uuid("Proyecto inválido"),
});

function primerError(error: z.ZodError): ActionState {
  return {
    message: error.issues[0]?.message ?? "Datos inválidos",
    status: "error",
  };
}

export async function importarEventoCalendario(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminUser();
  const parsed = importarSchema.safeParse({
    googleEventId: formData.get("googleEventId"),
    proyectoId: formData.get("proyectoId"),
  });
  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const token = await tokenDeCalendario(admin.id);
  if (!token) {
    return {
      message: "Conecta Google Calendar para agregar esta reunión.",
      status: "error",
    };
  }

  const evento = await obtenerEventoGoogle(token, parsed.data.googleEventId);
  if (!evento) {
    return {
      message: "No encontré esa reunión en tu calendario.",
      status: "error",
    };
  }

  const resultado = await agregarEventosDeGoogle({
    eventos: [
      {
        fecha: evento.fecha,
        googleEventId: evento.id,
        participantes: evento.participantes,
        titulo: evento.titulo,
      },
    ],
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  return { message: resultado.message, status: "success" };
}

export async function importarSerieCalendario(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminUser();
  const parsed = serieSchema.safeParse({
    proyectoId: formData.get("proyectoId"),
    serieId: formData.get("serieId"),
  });
  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const token = await tokenDeCalendario(admin.id);
  if (!token) {
    return {
      message: "Conecta Google Calendar para agregar esta serie.",
      status: "error",
    };
  }

  const eventos = await listarEventosGoogle(token);
  if (!eventos) {
    return { message: "No pude leer tu Google Calendar.", status: "error" };
  }

  const deLaSerie = eventos.filter(
    (evento) => evento.serieId === parsed.data.serieId
  );
  const resultado = await agregarEventosDeGoogle({
    eventos: deLaSerie.map((evento) => ({
      fecha: evento.fecha,
      googleEventId: evento.id,
      participantes: evento.participantes,
      titulo: evento.titulo,
    })),
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  return { message: resultado.message, status: "success" };
}

export async function desconectarCalendario(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminUser();
  const parsed = desconectarSchema.safeParse({
    proyectoId: formData.get("proyectoId"),
  });
  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const ok = await desconectarCalendarioDe(admin.id);
  if (!ok) {
    return { message: "No pude desconectar el calendario.", status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  return { message: "Google Calendar desconectado.", status: "success" };
}
