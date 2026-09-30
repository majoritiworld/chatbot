CREATE OR REPLACE FUNCTION private.sesion_puede_operar_entrevista(p_stakeholder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  email_enlace text;
  id_enlace text;
  email_sesion text;
BEGIN
  email_enlace := nullif(current_setting('app.enlace_email', true), '');
  id_enlace := nullif(current_setting('app.enlace_id', true), '');

  IF email_enlace IS NOT NULL AND id_enlace IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.entrevista AS entrevista
      JOIN public.stakeholder AS stakeholder
        ON stakeholder.id = entrevista.stakeholder_id
      JOIN public.tarea AS tarea
        ON tarea.entrevista_id = entrevista.id
       AND tarea.tipo = 'entrevista'
      JOIN public.fase AS fase
        ON fase.id = tarea.fase_id
      WHERE entrevista.id = id_enlace::uuid
        AND stakeholder.id = p_stakeholder_id
        AND lower(btrim(stakeholder.email)) = lower(btrim(email_enlace))
        AND fase.nombre = 'Entrevistas a colaboradores'
    );
  END IF;

  IF auth.uid() IS NULL OR p_stakeholder_id IS NULL THEN
    RETURN false;
  END IF;

  IF private.is_majoriti() THEN
    RETURN true;
  END IF;

  SELECT lower(btrim(users.email))
  INTO email_sesion
  FROM auth.users AS users
  WHERE users.id = auth.uid();

  IF email_sesion IS NULL OR email_sesion = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.stakeholder AS stakeholder
    JOIN public.proyecto_acceso AS acceso
      ON acceso.proyecto_id = stakeholder.proyecto_id
     AND acceso.email = lower(btrim(stakeholder.email))
    WHERE stakeholder.id = p_stakeholder_id
      AND lower(btrim(stakeholder.email)) = email_sesion
      AND acceso.rol IN ('stakeholder', 'cliente')
  );
END;
$$;

REVOKE ALL ON FUNCTION private.sesion_puede_operar_entrevista(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sesion_puede_operar_entrevista(uuid) FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.append_interview_turns_enlace(p_entrevista_id uuid, p_email text, p_turnos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  PERFORM public.append_interview_turns(p_entrevista_id, p_turnos);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_interview_section_enlace(p_entrevista_id uuid, p_email text, p_seccion_id text, p_completion jsonb, p_transcripcion jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  RETURN public.complete_interview_section(p_entrevista_id, p_seccion_id, p_completion, p_transcripcion);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_interview_enlace(p_entrevista_id uuid, p_email text, p_resumen jsonb, p_respuestas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  RETURN public.submit_interview(p_entrevista_id, p_resumen, p_respuestas);
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_interview_flow_enlace(p_entrevista_id uuid, p_email text, p_desde text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  RETURN public.advance_interview_flow(p_entrevista_id, p_desde);
END;
$$;

REVOKE ALL ON FUNCTION public.append_interview_turns_enlace(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_interview_section_enlace(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_interview_enlace(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_interview_flow_enlace(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.append_interview_turns_enlace(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_interview_section_enlace(uuid, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_interview_enlace(uuid, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_interview_flow_enlace(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_interview_notion_synced_enlace(p_entrevista_id uuid, p_page_id text, p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  email_stakeholder text;
  nombre_fase text;
BEGIN
  IF p_page_id IS NULL OR length(trim(p_page_id)) = 0 OR p_email IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  SELECT lower(btrim(s.email)), f.nombre
    INTO email_stakeholder, nombre_fase
  FROM public.entrevista e
  JOIN public.stakeholder s ON s.id = e.stakeholder_id
  JOIN public.tarea t ON t.entrevista_id = e.id AND t.tipo = 'entrevista'
  JOIN public.fase f ON f.id = t.fase_id
  WHERE e.id = p_entrevista_id
    AND e.estado = 'completada'
  LIMIT 1;

  IF email_stakeholder IS NULL
    OR email_stakeholder <> lower(btrim(p_email))
    OR nombre_fase <> 'Entrevistas a colaboradores'
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET notion_transcripcion_id = COALESCE(notion_transcripcion_id, trim(p_page_id))
  WHERE id = p_entrevista_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_interview_notion_synced_enlace(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_interview_notion_synced_enlace(uuid, text, text) TO service_role;
