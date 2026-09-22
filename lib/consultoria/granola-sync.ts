import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  debeReemplazarMinuta,
  minutaParaPortal,
} from "@/lib/consultoria/granola-nota";
import { createAdminClient } from "@/lib/supabase/admin";

const NOTE_ID = /^not_[a-zA-Z0-9]{14}$/;

const notaSchema = z.object({
  calendar_event: z
    .object({
      calendar_event_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  id: z.string(),
  summary_markdown: z.string().nullable().optional(),
  summary_text: z.string().optional(),
});

const webhookSchema = z.object({
  event_type: z.string().min(1),
  note_id: z.string().regex(NOTE_ID),
});

export function parseWebhookGranola(body: string) {
  try {
    return webhookSchema.safeParse(JSON.parse(body));
  } catch {
    return webhookSchema.safeParse(null);
  }
}

async function leerNota(
  noteId: string
): Promise<z.infer<typeof notaSchema> | null> {
  const apiKey = process.env.GRANOLA_API_KEY;
  if (!apiKey) {
    return null;
  }

  const respuesta = await fetch(
    `https://public-api.granola.ai/v1/notes/${noteId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!respuesta.ok) {
    return null;
  }
  const parsed = notaSchema.safeParse(await respuesta.json());
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function sincronizarNotaGranola(noteId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return "error" as const;
  }

  const nota = await leerNota(noteId);
  if (!nota) {
    return "error" as const;
  }

  const calendarEventId = nota.calendar_event?.calendar_event_id;
  if (!calendarEventId) {
    return "sin-evento" as const;
  }

  const minuta = minutaParaPortal({
    summary_markdown: nota.summary_markdown ?? null,
    summary_text: nota.summary_text ?? "",
  });
  if (!minuta) {
    return "omitida" as const;
  }

  const { data, error } = await admin
    .from("evento")
    .select("id, proyecto_id, minuta, granola_note_id")
    .eq("google_event_id", calendarEventId)
    .maybeSingle();

  if (error) {
    return "error" as const;
  }
  if (!data) {
    return "sin-evento" as const;
  }

  const fila = data as {
    granola_note_id: string | null;
    id: string;
    minuta: string | null;
    proyecto_id: string;
  };

  if (
    !debeReemplazarMinuta(
      { granolaNoteId: fila.granola_note_id, minuta: fila.minuta },
      noteId
    )
  ) {
    return "omitida" as const;
  }

  const actualizado = await admin
    .from("evento")
    .update({ granola_note_id: noteId, minuta })
    .eq("id", fila.id);

  if (actualizado.error) {
    return "error" as const;
  }

  revalidatePath(`/admin/${fila.proyecto_id}`);
  revalidatePath("/portal");
  return "ok" as const;
}
