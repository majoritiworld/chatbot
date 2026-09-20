-- Dedicated close-offer pointer for the active interview section.
-- Do not apply this remotely until the pilot candidate is authorized to
-- change the shared database. Until then, `transcripcion[].ofertaCierre`
-- with matching seccionId reconstructs the button after reload.

ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS oferta_cierre_seccion_id text;

CREATE OR REPLACE FUNCTION public.offer_interview_section_close(
  p_entrevista_id uuid,
  p_seccion_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  active_section_id text;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR (
      entrevista_row.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  active_section_id :=
    entrevista_row.secciones -> entrevista_row.seccion_actual ->> 'id';

  IF entrevista_row.estado <> 'abierta'
    OR entrevista_row.flujo_estado <> 'chat'
    OR active_section_id IS DISTINCT FROM p_seccion_id
  THEN
    RAISE EXCEPTION 'Interview section changed';
  END IF;

  UPDATE public.entrevista AS e
  SET oferta_cierre_seccion_id = p_seccion_id
  WHERE e.id = p_entrevista_id
    AND e.oferta_cierre_seccion_id IS DISTINCT FROM p_seccion_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.offer_interview_section_close(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_interview_section_close(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_interview_section(
  p_entrevista_id uuid,
  p_seccion_id text,
  p_completion jsonb,
  p_transcripcion jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  active_section_id text;
  new_turns jsonb;
  next_index integer;
  next_state text;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR (
      entrevista_row.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista_row.secciones_completadas) AS completed
    WHERE completed ->> 'seccionId' = p_seccion_id
  ) THEN
    RETURN jsonb_build_object(
      'flujoEstado', entrevista_row.flujo_estado,
      'seccionActual', entrevista_row.seccion_actual,
      'seccionId', p_seccion_id
    );
  END IF;

  active_section_id :=
    entrevista_row.secciones -> entrevista_row.seccion_actual ->> 'id';

  IF entrevista_row.estado <> 'abierta'
    OR entrevista_row.flujo_estado <> 'chat'
    OR active_section_id IS DISTINCT FROM p_seccion_id
    OR p_completion ->> 'seccionId' IS DISTINCT FROM p_seccion_id
    OR coalesce(p_completion ->> 'sintesis', '') = ''
    OR p_completion ->> 'modo' NOT IN ('agente', 'manual')
    OR jsonb_typeof(p_completion -> 'hallazgos') <> 'array'
    OR jsonb_typeof(p_completion -> 'respuestas') <> 'array'
    OR jsonb_typeof(p_transcripcion) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_transcripcion) AS turno
      WHERE jsonb_typeof(turno) <> 'object'
        OR coalesce(turno ->> 'id', '') = ''
        OR coalesce(turno ->> 'texto', '') = ''
        OR turno ->> 'rol' NOT IN ('entrevistador', 'entrevistado')
        OR turno ->> 'seccionId' IS DISTINCT FROM p_seccion_id
    )
  THEN
    RAISE EXCEPTION 'Interview section changed';
  END IF;

  SELECT coalesce(jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
  INTO new_turns
  FROM jsonb_array_elements(p_transcripcion) WITH ORDINALITY AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista_row.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  next_index := entrevista_row.seccion_actual + 1;
  next_state := CASE
    WHEN next_index < jsonb_array_length(entrevista_row.secciones)
      THEN 'presentacion'
    ELSE 'revision'
  END;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET
    flujo_estado = next_state,
    seccion_actual = next_index,
    secciones_completadas =
      e.secciones_completadas || jsonb_build_array(p_completion),
    transcripcion = e.transcripcion || new_turns,
    oferta_cierre_seccion_id = NULL,
    ultima_actividad = now()
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista_row.stakeholder_id
    AND estado_entrevista = 'pendiente';

  RETURN jsonb_build_object(
    'flujoEstado', next_state,
    'seccionActual', next_index,
    'seccionId', p_seccion_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_interview_section(uuid, text, jsonb, jsonb) FROM anon;
