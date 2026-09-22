-- Remember which Notion page holds the interview transcript so a retry
-- does not create a second row.

ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS notion_transcripcion_id text;

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
    OR NEW.notion_transcripcion_id IS DISTINCT FROM OLD.notion_transcripcion_id
  THEN
    RAISE EXCEPTION 'Interview flow fields can only change through validated transitions';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_interview_notion_synced(
  p_entrevista_id uuid,
  p_page_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
BEGIN
  IF p_page_id IS NULL OR length(trim(p_page_id)) = 0 THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR entrevista_row.estado <> 'completada'
    OR (
      entrevista_row.stakeholder_id IS DISTINCT FROM private.own_stakeholder_id()
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET notion_transcripcion_id = COALESCE(notion_transcripcion_id, trim(p_page_id))
  WHERE id = p_entrevista_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_interview_notion_synced(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_interview_notion_synced(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_interview_notion_synced(uuid, text) TO authenticated;
