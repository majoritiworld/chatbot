-- Records acceptance for one interview. It does not backfill existing rows:
-- a null consentimiento_en stays null until this function runs.

CREATE OR REPLACE FUNCTION public.accept_interview_consent(p_entrevista_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  sello timestamptz;
BEGIN
  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR NOT private.sesion_puede_operar_entrevista(entrevista.stakeholder_id)
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF entrevista.consentimiento_en IS NOT NULL THEN
    RETURN entrevista.consentimiento_en;
  END IF;

  UPDATE public.entrevista AS e
  SET consentimiento_en = now()
  WHERE e.id = entrevista.id
    AND e.stakeholder_id = entrevista.stakeholder_id
    AND e.consentimiento_en IS NULL
  RETURNING e.consentimiento_en INTO sello;

  IF sello IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  RETURN sello;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_interview_consent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_interview_consent(uuid) FROM anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_interview_consent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_interview_consent_enlace(
  p_entrevista_id uuid,
  p_email text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_email IS NULL OR length(btrim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  RETURN public.accept_interview_consent(p_entrevista_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_interview_consent_enlace(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_interview_consent_enlace(uuid, text) TO service_role;
