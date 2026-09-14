-- Agentic interview template: one skill per project/phase, cloned per recipient.

CREATE TABLE public.entrevista_plantilla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.fase(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  preguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entrevista_plantilla_proyecto_id_idx
  ON public.entrevista_plantilla (proyecto_id);

CREATE INDEX entrevista_plantilla_fase_id_idx
  ON public.entrevista_plantilla (fase_id);

ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS plantilla_id uuid REFERENCES public.entrevista_plantilla(id) ON DELETE SET NULL;

CREATE INDEX entrevista_plantilla_id_idx
  ON public.entrevista (plantilla_id);

CREATE UNIQUE INDEX entrevista_stakeholder_plantilla_uidx
  ON public.entrevista (stakeholder_id, plantilla_id)
  WHERE plantilla_id IS NOT NULL;

ALTER TABLE public.entrevista_plantilla ENABLE ROW LEVEL SECURITY;

CREATE POLICY entrevista_plantilla_majoriti_all ON public.entrevista_plantilla
  FOR ALL
  TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());
