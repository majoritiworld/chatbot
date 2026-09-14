-- Link a Fase to an Entrevista through its Tarea.
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS entrevista_id uuid REFERENCES public.entrevista(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tarea_fase_id_idx ON public.tarea (fase_id);
CREATE INDEX IF NOT EXISTS tarea_entrevista_id_idx ON public.tarea (entrevista_id);
CREATE INDEX IF NOT EXISTS fase_proyecto_id_idx ON public.fase (proyecto_id);

-- firma_socia had no read access to the phase timeline of its own project.
DROP POLICY IF EXISTS fase_firma_select ON public.fase;
CREATE POLICY fase_firma_select ON public.fase
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND proyecto_id IN (
      SELECT s.proyecto_id FROM public.stakeholder s
      WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS tarea_firma_select ON public.tarea;
CREATE POLICY tarea_firma_select ON public.tarea
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND fase_id IN (
      SELECT f.id FROM public.fase f
      WHERE f.proyecto_id IN (
        SELECT s.proyecto_id FROM public.stakeholder s
        WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

-- Finishing an interview writes entrevista.estado and stakeholder.estado_entrevista.
-- Without these the writes silently affected zero rows.
DROP POLICY IF EXISTS entrevista_cliente_update ON public.entrevista;
CREATE POLICY entrevista_cliente_update ON public.entrevista
  FOR UPDATE
  USING (
    public.current_user_rol() = 'cliente'
    AND stakeholder_id IN (
      SELECT s.id FROM public.stakeholder s
      WHERE s.proyecto_id = public.current_user_proyecto_id()
    )
  )
  WITH CHECK (
    public.current_user_rol() = 'cliente'
    AND stakeholder_id IN (
      SELECT s.id FROM public.stakeholder s
      WHERE s.proyecto_id = public.current_user_proyecto_id()
    )
  );

DROP POLICY IF EXISTS stakeholder_cliente_update ON public.stakeholder;
CREATE POLICY stakeholder_cliente_update ON public.stakeholder
  FOR UPDATE
  USING (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
  )
  WITH CHECK (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
  );

DROP POLICY IF EXISTS stakeholder_firma_update ON public.stakeholder;
CREATE POLICY stakeholder_firma_update ON public.stakeholder
  FOR UPDATE
  USING (
    public.current_user_rol() = 'firma_socia'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    public.current_user_rol() = 'firma_socia'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Realtime for the interview completion screen.
ALTER PUBLICATION supabase_realtime ADD TABLE public.entrevista;
