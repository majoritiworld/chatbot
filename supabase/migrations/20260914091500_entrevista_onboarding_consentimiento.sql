-- Applied via Supabase MCP (entrevista_onboarding_consentimiento).
-- Stamp when the respondent accepted the interview onboarding.

ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS consentimiento_en timestamptz;

-- Client-team members who also have an interview (rol = cliente) could
-- read it but not write it. Own-row writes cover both cliente and stakeholder.
DROP POLICY IF EXISTS entrevista_propia_update ON public.entrevista;
CREATE POLICY entrevista_propia_update ON public.entrevista
  FOR UPDATE
  USING (stakeholder_id = public.own_stakeholder_id())
  WITH CHECK (stakeholder_id = public.own_stakeholder_id());

DROP POLICY IF EXISTS respuesta_propia_insert ON public.respuesta;
CREATE POLICY respuesta_propia_insert ON public.respuesta
  FOR INSERT
  WITH CHECK (
    entrevista_id IN (
      SELECT e.id
      FROM public.entrevista e
      WHERE e.stakeholder_id = public.own_stakeholder_id()
    )
  );

DROP POLICY IF EXISTS stakeholder_propia_update ON public.stakeholder;
CREATE POLICY stakeholder_propia_update ON public.stakeholder
  FOR UPDATE
  USING (id = public.own_stakeholder_id())
  WITH CHECK (id = public.own_stakeholder_id());
