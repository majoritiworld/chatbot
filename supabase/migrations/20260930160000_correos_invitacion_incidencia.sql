-- Invitation copy is separate from the confirmation copy (correo_*), so a
-- subject or body written for one message never lands in the other.
ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS invitacion_asunto text,
  ADD COLUMN IF NOT EXISTS invitacion_cuerpo text;

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS invitacion_asunto text,
  ADD COLUMN IF NOT EXISTS invitacion_cuerpo text;

-- Why an interview mail was blocked or failed. Admin-facing only: RLS is on
-- and there are no policies, so only the service role reads or writes it.
CREATE TABLE IF NOT EXISTS public.entrevista_correo_incidencia (
  entrevista_id uuid PRIMARY KEY REFERENCES public.entrevista(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entrevista_correo_incidencia ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.entrevista_correo_incidencia FROM anon, authenticated;
