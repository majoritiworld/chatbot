"use server";

import { z } from "zod";
import { aceptarConsentimientoEntrevista } from "@/lib/consultoria/entrevistas";

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
