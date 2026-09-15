-- Stable message IDs make transcript appends idempotent without collapsing
-- legitimate repeated answers such as two separate "Sí" turns.
UPDATE public.entrevista AS e
SET transcripcion = (
  SELECT jsonb_agg(
    CASE
      WHEN turno.value ? 'id' THEN turno.value
      ELSE turno.value || jsonb_build_object('id', gen_random_uuid()::text)
    END
    ORDER BY turno.ordinality
  )
  FROM jsonb_array_elements(e.transcripcion) WITH ORDINALITY AS turno
)
WHERE jsonb_typeof(e.transcripcion) = 'array'
  AND jsonb_array_length(e.transcripcion) > 0;

CREATE OR REPLACE FUNCTION public.append_interview_turns(
  p_entrevista_id uuid,
  p_turnos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  nuevos_turnos jsonb;
BEGIN
  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR entrevista.estado <> 'abierta'
    OR (
      entrevista.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
    OR jsonb_typeof(p_turnos) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_turnos) AS turno
      WHERE jsonb_typeof(turno) <> 'object'
        OR coalesce(turno ->> 'id', '') = ''
        OR coalesce(turno ->> 'texto', '') = ''
        OR turno ->> 'rol' NOT IN ('entrevistador', 'entrevistado')
    )
  THEN
    RAISE EXCEPTION 'Invalid interview turns';
  END IF;

  SELECT coalesce(jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
  INTO nuevos_turnos
  FROM jsonb_array_elements(p_turnos) WITH ORDINALITY AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  UPDATE public.entrevista
  SET
    transcripcion = entrevista.transcripcion || nuevos_turnos,
    ultima_actividad = now()
  WHERE id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista.stakeholder_id
    AND estado_entrevista = 'pendiente';
END;
$$;

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
  entrevista public.entrevista%ROWTYPE;
  active_section_id text;
  new_turns jsonb;
  next_index integer;
  next_state text;
BEGIN
  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR (
      entrevista.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  active_section_id :=
    entrevista.secciones -> entrevista.seccion_actual ->> 'id';

  IF entrevista.estado <> 'abierta'
    OR entrevista.flujo_estado <> 'chat'
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
    FROM jsonb_array_elements(entrevista.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  next_index := entrevista.seccion_actual + 1;
  next_state := CASE
    WHEN next_index < jsonb_array_length(entrevista.secciones)
      THEN 'presentacion'
    ELSE 'revision'
  END;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET
    flujo_estado = next_state,
    seccion_actual = next_index,
    secciones_completadas =
      entrevista.secciones_completadas || jsonb_build_array(p_completion),
    transcripcion = entrevista.transcripcion || new_turns,
    ultima_actividad = now()
  WHERE id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista.stakeholder_id
    AND estado_entrevista = 'pendiente';

  RETURN jsonb_build_object(
    'flujoEstado', next_state,
    'seccionActual', next_index,
    'seccionId', p_seccion_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_interview_turns(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.append_interview_turns(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.append_interview_turns(uuid, jsonb) TO authenticated;
