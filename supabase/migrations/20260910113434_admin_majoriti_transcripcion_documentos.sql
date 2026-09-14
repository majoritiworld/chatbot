-- Interview transcript + structured summary + activity clock.
ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS transcripcion jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resumen jsonb,
  ADD COLUMN IF NOT EXISTS ultima_actividad timestamptz;

-- Documents can hang off a specific phase. `link` holds either an external
-- URL or a Storage object path inside the `documentos` bucket.
ALTER TABLE public.documento
  ADD COLUMN IF NOT EXISTS fase_id uuid REFERENCES public.fase(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS documento_fase_id_idx ON public.documento (fase_id);
CREATE INDEX IF NOT EXISTS documento_proyecto_id_idx ON public.documento (proyecto_id);
CREATE INDEX IF NOT EXISTS entrevista_stakeholder_id_idx ON public.entrevista (stakeholder_id);
CREATE INDEX IF NOT EXISTS stakeholder_proyecto_id_idx ON public.stakeholder (proyecto_id);

-- The client portal needs phase completions pushed live, same as entrevista.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fase'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fase;
  END IF;
END $$;
