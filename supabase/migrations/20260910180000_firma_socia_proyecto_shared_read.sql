-- Applied via Supabase MCP (firma_socia_proyecto_shared_read).
-- Source of truth mirror for local reference.
--
-- firma_socia: read project/phases/tasks by usuario.proyecto_id OR email match
-- (keeps Ana/ACME working). Shared SELECT on stakeholder + entrevista within
-- the project; writes remain own-stakeholder only.

DROP POLICY IF EXISTS proyecto_firma_select ON public.proyecto;
CREATE POLICY proyecto_firma_select ON public.proyecto
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND (
      id = public.current_user_proyecto_id()
      OR id IN (
        SELECT s.proyecto_id FROM public.stakeholder s
        WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

DROP POLICY IF EXISTS fase_firma_select ON public.fase;
CREATE POLICY fase_firma_select ON public.fase
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND (
      proyecto_id = public.current_user_proyecto_id()
      OR proyecto_id IN (
        SELECT s.proyecto_id FROM public.stakeholder s
        WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );

DROP POLICY IF EXISTS tarea_firma_select ON public.tarea;
CREATE POLICY tarea_firma_select ON public.tarea
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND fase_id IN (
      SELECT f.id FROM public.fase f
      WHERE f.proyecto_id = public.current_user_proyecto_id()
         OR f.proyecto_id IN (
           SELECT s.proyecto_id FROM public.stakeholder s
           WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         )
    )
  );

DROP POLICY IF EXISTS stakeholder_firma_select ON public.stakeholder;
CREATE POLICY stakeholder_firma_select ON public.stakeholder
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND (
      proyecto_id = public.current_user_proyecto_id()
      OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS entrevista_firma_select ON public.entrevista;
CREATE POLICY entrevista_firma_select ON public.entrevista
  FOR SELECT
  USING (
    public.current_user_rol() = 'firma_socia'
    AND (
      stakeholder_id = public.own_stakeholder_id()
      OR stakeholder_id IN (
        SELECT s.id FROM public.stakeholder s
        WHERE s.proyecto_id = public.current_user_proyecto_id()
      )
    )
  );

DROP POLICY IF EXISTS entrevista_firma_update ON public.entrevista;
CREATE POLICY entrevista_firma_update ON public.entrevista
  FOR UPDATE
  USING (
    public.current_user_rol() = 'firma_socia'
    AND stakeholder_id = public.own_stakeholder_id()
  )
  WITH CHECK (
    public.current_user_rol() = 'firma_socia'
    AND stakeholder_id = public.own_stakeholder_id()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stakeholder'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stakeholder;
  END IF;
END $$;
