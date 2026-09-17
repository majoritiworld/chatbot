-- Checklist tasks on a phase, assigned to a project stakeholder.

ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS nombre text;

ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS stakeholder_id uuid REFERENCES public.stakeholder(id) ON DELETE SET NULL;

ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tarea_stakeholder_id_idx ON public.tarea (stakeholder_id);
CREATE INDEX IF NOT EXISTS tarea_fase_tipo_idx ON public.tarea (fase_id, tipo);

ALTER TABLE public.tarea
  DROP CONSTRAINT IF EXISTS tarea_general_nombre_chk;

ALTER TABLE public.tarea
  ADD CONSTRAINT tarea_general_nombre_chk
  CHECK (
    tipo <> 'general'
    OR (nombre IS NOT NULL AND length(btrim(nombre)) > 0)
  );

DROP POLICY IF EXISTS tarea_cliente_update ON public.tarea;
CREATE POLICY tarea_cliente_update ON public.tarea
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND tipo = 'general'
    AND fase_id IN (
      SELECT f.id FROM public.fase f
      WHERE f.proyecto_id = (SELECT private.current_user_proyecto_id())
    )
  )
  WITH CHECK (
    (SELECT private.current_user_rol()) = 'cliente'
    AND tipo = 'general'
    AND fase_id IN (
      SELECT f.id FROM public.fase f
      WHERE f.proyecto_id = (SELECT private.current_user_proyecto_id())
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tarea'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tarea;
  END IF;
END $$;
