-- Stores the client consultation summary after the interview is already
-- submitted. Status, answers, and the thank-you email stay untouched.

CREATE OR REPLACE FUNCTION public.guardar_sintesis_consulta(
  p_entrevista_id uuid,
  p_consulta jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  proyecto_entrevista uuid;
  autorizado boolean;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  SELECT stakeholder.proyecto_id
  INTO proyecto_entrevista
  FROM public.stakeholder AS stakeholder
  WHERE stakeholder.id = entrevista_row.stakeholder_id;

  -- A NULL comparison must stay false. IF treats NULL as "do not enter",
  -- which would skip the rejection.
  autorizado := coalesce(
    private.sesion_puede_operar_entrevista(entrevista_row.stakeholder_id)
    OR (
      private.current_user_rol() = 'cliente'
      AND proyecto_entrevista IS NOT NULL
      AND proyecto_entrevista IS NOT DISTINCT FROM private.current_user_proyecto_id()
    ),
    false
  );

  IF entrevista_row.id IS NULL OR autorizado IS NOT TRUE THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF entrevista_row.estado <> 'completada' THEN
    RAISE EXCEPTION 'Interview is not submitted';
  END IF;

  IF length(btrim(coalesce(entrevista_row.resumen #>> '{consulta,sintesis}', ''))) > 0 THEN
    RETURN jsonb_build_object('alreadyDone', true);
  END IF;

  IF jsonb_typeof(p_consulta) <> 'object'
    OR jsonb_typeof(p_consulta -> 'citas') <> 'array'
    OR length(btrim(coalesce(p_consulta ->> 'sintesis', ''))) = 0
    OR length(btrim(p_consulta ->> 'sintesis')) > 4000
    OR jsonb_array_length(p_consulta -> 'citas') > 4
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_consulta -> 'citas') AS cita
      WHERE jsonb_typeof(cita) <> 'string'
        OR length(btrim(cita #>> '{}')) = 0
        OR length(btrim(cita #>> '{}')) > 2000
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            coalesce(entrevista_row.transcripcion, '[]'::jsonb)
          ) AS turno
          WHERE turno ->> 'rol' = 'entrevistado'
            AND strpos(
              replace(coalesce(turno ->> 'texto', ''), chr(8203), ''),
              btrim(cita #>> '{}')
            ) > 0
        )
    )
  THEN
    RAISE EXCEPTION 'Quote is not literal';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET resumen = jsonb_set(
    coalesce(e.resumen, '{}'::jsonb),
    '{consulta}',
    jsonb_build_object(
      'citas',
      (
        SELECT coalesce(
          jsonb_agg(btrim(cita.valor #>> '{}') ORDER BY cita.ordinality),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(p_consulta -> 'citas')
          WITH ORDINALITY AS cita(valor, ordinality)
      ),
      'sintesis',
      btrim(p_consulta ->> 'sintesis')
    ),
    true
  )
  WHERE e.id = entrevista_row.id;

  RETURN jsonb_build_object('alreadyDone', false);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_sintesis_consulta(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardar_sintesis_consulta(uuid, jsonb) FROM anon, service_role;
GRANT EXECUTE ON FUNCTION public.guardar_sintesis_consulta(uuid, jsonb) TO authenticated;
