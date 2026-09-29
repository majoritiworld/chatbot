-- Agent-only rules shared by every section of an interview, and the form of
-- address the agent must keep. Neither is ever shown to the participant.

ALTER TABLE public.entrevista_plantilla
  ADD COLUMN IF NOT EXISTS instrucciones_agente text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trato text NOT NULL DEFAULT 'tu';

ALTER TABLE public.entrevista
  ADD COLUMN IF NOT EXISTS instrucciones_agente text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trato text NOT NULL DEFAULT 'tu';

ALTER TABLE public.entrevista_plantilla
  DROP CONSTRAINT IF EXISTS entrevista_plantilla_trato_valido,
  ADD CONSTRAINT entrevista_plantilla_trato_valido
  CHECK (trato IN ('tu', 'usted'));

ALTER TABLE public.entrevista
  DROP CONSTRAINT IF EXISTS entrevista_trato_valido,
  ADD CONSTRAINT entrevista_trato_valido
  CHECK (trato IN ('tu', 'usted'));

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
    OR NEW.instrucciones_agente IS DISTINCT FROM OLD.instrucciones_agente
    OR NEW.trato IS DISTINCT FROM OLD.trato
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
