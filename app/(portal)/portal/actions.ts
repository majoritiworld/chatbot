"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aceptarConsentimientoEntrevista } from "@/lib/consultoria/entrevistas";
import { requirePortalUser } from "@/lib/consultoria/portal";
import { marcarTareaDelPortal } from "@/lib/consultoria/tareas";

export type OnboardingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const entrevistaIdSchema = z.guid();

export async function aceptarOnboardingEntrevista(
  _prev: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const parsed = entrevistaIdSchema.safeParse(formData.get("entrevistaId"));

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Entrevista inválida",
      status: "error",
    };
  }

  try {
    await aceptarConsentimientoEntrevista(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo empezar";
    return { message, status: "error" };
  }
}

const marcarTareaSchema = z.object({
  completada: z.boolean(),
  tareaId: z.guid(),
});

export async function marcarTarea(
  tareaId: string,
  completada: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = marcarTareaSchema.safeParse({ completada, tareaId });
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Tarea inválida",
      ok: false,
    };
  }

  const portalUser = await requirePortalUser();
  const resultado = await marcarTareaDelPortal({
    completada: parsed.data.completada,
    proyectoId: portalUser.proyectoId,
    tareaId: parsed.data.tareaId,
  });

  if (resultado.ok) {
    revalidatePath("/portal");
  }

  return resultado;
}
