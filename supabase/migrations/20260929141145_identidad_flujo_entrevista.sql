-- advance_interview_flow and mark_interview_thank_you_sent used
-- private.stakeholder_es_propio, which trusts the JWT email claim.
-- Identity now comes from auth.uid() joined to auth.users, the same
-- check as the other interview RPCs. own_stakeholder_id stops reading
-- the claim as well. Cliente select policies are unchanged.

CREATE OR REPLACE FUNCTION private.own_stakeholder_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT stakeholder.id
  FROM auth.users AS users
  JOIN public.stakeholder AS stakeholder
    ON lower(btrim(stakeholder.email)) = lower(btrim(users.email))
  WHERE users.id = (SELECT auth.uid())
    AND users.email IS NOT NULL
    AND btrim(users.email) <> ''
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.own_stakeholder_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.own_stakeholder_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.advance_interview_flow(
  p_entrevista_id uuid,
  p_desde text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  destino text;
BEGIN
  IF p_desde NOT IN ('bienvenida', 'presentacion') THEN
    RAISE EXCEPTION 'Invalid interview transition';
  END IF;

  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR NOT private.sesion_puede_operar_entrevista(entrevista.stakeholder_id)
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF entrevista.estado <> 'abierta'
    OR entrevista.flujo_estado <> p_desde
    OR jsonb_array_length(entrevista.secciones) = 0
  THEN
    RAISE EXCEPTION 'Interview changed';
  END IF;

  destino := CASE
    WHEN p_desde = 'bienvenida' THEN 'presentacion'
    ELSE 'chat'
  END;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET flujo_estado = destino
  WHERE e.id = entrevista.id
    AND e.stakeholder_id = entrevista.stakeholder_id;

  RETURN jsonb_build_object('flujoEstado', destino);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_interview_thank_you_sent(
  p_entrevista_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
BEGIN
  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR entrevista.estado <> 'completada'
    OR NOT private.sesion_puede_operar_entrevista(entrevista.stakeholder_id)
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET correo_agradecimiento_en = COALESCE(e.correo_agradecimiento_en, now())
  WHERE e.id = entrevista.id
    AND e.stakeholder_id = entrevista.stakeholder_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_interview_flow(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_interview_thank_you_sent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_interview_flow(uuid, text) FROM anon, service_role;
REVOKE ALL ON FUNCTION public.mark_interview_thank_you_sent(uuid) FROM anon, service_role;
GRANT EXECUTE ON FUNCTION public.advance_interview_flow(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_interview_thank_you_sent(uuid) TO authenticated;
