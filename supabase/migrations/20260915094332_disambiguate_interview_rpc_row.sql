-- A PL/pgSQL record named `entrevista` collides with table `entrevista` in
-- SQL statements (jsonb_array_elements, UPDATE SET). Postgres then raises
-- 42702 "column reference is ambiguous" and the portal cannot finish a
-- section or append transcript turns.

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
  entrevista_row public.entrevista%ROWTYPE;
  nuevos_turnos jsonb;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR entrevista_row.estado <> 'abierta'
    OR (
      entrevista_row.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
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
    FROM jsonb_array_elements(entrevista_row.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  UPDATE public.entrevista AS e
  SET
    transcripcion = e.transcripcion || nuevos_turnos,
    ultima_actividad = now()
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista_row.stakeholder_id
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

CREATE OR REPLACE FUNCTION public.submit_interview(
  p_entrevista_id uuid,
  p_resumen jsonb,
  p_respuestas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  ahora timestamptz := now();
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

  IF entrevista_row.estado = 'completada' THEN
    RETURN jsonb_build_object('alreadyDone', true);
  END IF;

  IF entrevista_row.estado <> 'abierta'
    OR entrevista_row.flujo_estado <> 'revision'
    OR jsonb_typeof(p_respuestas) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(entrevista_row.secciones) AS section
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(entrevista_row.secciones_completadas) AS completed
        WHERE completed ->> 'seccionId' = section ->> 'id'
      )
    )
  THEN
    RAISE EXCEPTION 'Interview is not ready to submit';
  END IF;

  INSERT INTO public.respuesta (
    entrevista_id,
    pregunta,
    respuesta_texto
  )
  SELECT
    p_entrevista_id,
    response ->> 'pregunta',
    response ->> 'respuesta_texto'
  FROM jsonb_array_elements(p_respuestas) AS response;

  INSERT INTO public.respuesta (
    entrevista_id,
    pregunta,
    respuesta_texto
  )
  VALUES (
    p_entrevista_id,
    '__resumen__',
    COALESCE(p_resumen ->> 'sintesis', '')
  );

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET
    estado = 'completada',
    fecha_completada = ahora,
    resumen = p_resumen,
    ultima_actividad = ahora
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'completada'
  WHERE id = entrevista_row.stakeholder_id;

  RETURN jsonb_build_object('alreadyDone', false);
END;
$$;
