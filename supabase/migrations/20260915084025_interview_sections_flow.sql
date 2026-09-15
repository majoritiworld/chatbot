-- Persisted, resumable interview flow. Templates remain reusable while each
-- assigned interview receives its own immutable section snapshot.

ALTER TABLE public.entrevista_plantilla
  ADD COLUMN secciones jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.entrevista
  ADD COLUMN secciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN flujo_estado text NOT NULL DEFAULT 'bienvenida',
  ADD COLUMN seccion_actual integer NOT NULL DEFAULT 0,
  ADD COLUMN secciones_completadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN correo_agradecimiento_en timestamptz;

ALTER TABLE public.entrevista_plantilla
  ADD CONSTRAINT entrevista_plantilla_secciones_array
  CHECK (jsonb_typeof(secciones) = 'array');

ALTER TABLE public.entrevista
  ADD CONSTRAINT entrevista_secciones_array
  CHECK (jsonb_typeof(secciones) = 'array'),
  ADD CONSTRAINT entrevista_secciones_completadas_array
  CHECK (jsonb_typeof(secciones_completadas) = 'array'),
  ADD CONSTRAINT entrevista_flujo_estado_valido
  CHECK (
    flujo_estado IN ('bienvenida', 'presentacion', 'chat', 'revision')
  ),
  ADD CONSTRAINT entrevista_seccion_actual_no_negativa
  CHECK (seccion_actual >= 0);

-- Preserve the behavior of already-authored flat guides by wrapping the whole
-- guide in one section. New templates are authored as structured sections.
UPDATE public.entrevista_plantilla
SET secciones = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'titulo', nombre,
    'descripcion', '',
    'preguntas', preguntas
  )
)
WHERE jsonb_typeof(preguntas) = 'array'
  AND jsonb_array_length(preguntas) > 0;

UPDATE public.entrevista
SET secciones = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'titulo', 'Entrevista',
    'descripcion', '',
    'preguntas', preguntas
  )
)
WHERE jsonb_typeof(preguntas) = 'array'
  AND jsonb_array_length(preguntas) > 0;

-- Existing conversations resume in chat rather than replaying the new welcome.
UPDATE public.entrevista
SET flujo_estado = 'chat'
WHERE estado = 'abierta'
  AND jsonb_typeof(transcripcion) = 'array'
  AND jsonb_array_length(transcripcion) > 0;
