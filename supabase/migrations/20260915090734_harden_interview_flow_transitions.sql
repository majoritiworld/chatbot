-- Tag legacy transcript turns so replaying them does not create duplicates.
UPDATE public.entrevista AS e
SET transcripcion = (
  SELECT jsonb_agg(
    CASE
      WHEN turno.value ? 'seccionId' THEN turno.value
      ELSE turno.value || jsonb_build_object(
        'seccionId',
        e.secciones -> 0 ->> 'id'
      )
    END
    ORDER BY turno.ordinality
  ) AS turnos
  FROM jsonb_array_elements(e.transcripcion) WITH ORDINALITY AS turno
)
WHERE jsonb_typeof(e.transcripcion) = 'array'
  AND jsonb_array_length(e.transcripcion) > 0
  AND jsonb_array_length(e.secciones) > 0;

-- Do not offer a retroactive thank-you email for interviews completed before
-- this feature existed.
UPDATE public.entrevista
SET correo_agradecimiento_en = fecha_completada
WHERE estado = 'completada'
  AND correo_agradecimiento_en IS NULL;

CREATE OR REPLACE FUNCTION private.protect_interview_flow_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF private.is_majoriti()
    OR current_setting('app.interview_transition', true) = 'allowed'
  THEN
    RETURN NEW;
  END IF;

  IF NEW.stakeholder_id IS DISTINCT FROM OLD.stakeholder_id
    OR NEW.plantilla_id IS DISTINCT FROM OLD.plantilla_id
    OR NEW.preguntas IS DISTINCT FROM OLD.preguntas
    OR NEW.secciones IS DISTINCT FROM OLD.secciones
    OR NEW.estado IS DISTINCT FROM OLD.estado
    OR NEW.fecha_completada IS DISTINCT FROM OLD.fecha_completada
    OR NEW.resumen IS DISTINCT FROM OLD.resumen
    OR NEW.flujo_estado IS DISTINCT FROM OLD.flujo_estado
    OR NEW.seccion_actual IS DISTINCT FROM OLD.seccion_actual
    OR NEW.secciones_completadas IS DISTINCT FROM OLD.secciones_completadas
    OR NEW.correo_agradecimiento_en IS DISTINCT FROM OLD.correo_agradecimiento_en
  THEN
    RAISE EXCEPTION 'Interview flow fields can only change through validated transitions';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_interview_flow_fields
BEFORE UPDATE ON public.entrevista
FOR EACH ROW
EXECUTE FUNCTION private.protect_interview_flow_fields();

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
    OR (
      entrevista.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
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
  UPDATE public.entrevista
  SET flujo_estado = destino
  WHERE id = p_entrevista_id;

  RETURN jsonb_build_object('flujoEstado', destino);
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
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  active_section_id text;
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
    OR jsonb_typeof(p_transcripcion) <> 'array'
  THEN
    RAISE EXCEPTION 'Interview section changed';
  END IF;

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
    transcripcion = p_transcripcion,
    ultima_actividad = now()
  WHERE id = p_entrevista_id;

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
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  ahora timestamptz := now();
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

  IF entrevista.estado = 'completada' THEN
    RETURN jsonb_build_object('alreadyDone', true);
  END IF;

  IF entrevista.estado <> 'abierta'
    OR entrevista.flujo_estado <> 'revision'
    OR jsonb_typeof(p_respuestas) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(entrevista.secciones) AS section
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(entrevista.secciones_completadas) AS completed
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
  UPDATE public.entrevista
  SET
    estado = 'completada',
    fecha_completada = ahora,
    resumen = p_resumen,
    ultima_actividad = ahora
  WHERE id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'completada'
  WHERE id = entrevista.stakeholder_id;

  RETURN jsonb_build_object('alreadyDone', false);
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
    OR (
      entrevista.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET correo_agradecimiento_en = COALESCE(correo_agradecimiento_en, now())
  WHERE id = p_entrevista_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_interview_flow(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_interview_section(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_interview(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_interview_thank_you_sent(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.advance_interview_flow(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_interview_section(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_interview(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_interview_thank_you_sent(uuid) TO authenticated;
