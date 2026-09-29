-- Participant-facing copy lives on the project. A phase may override it.
-- The commercial block is phase-only, so it is absent unless that phase sets it.

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS aviso_respuestas text,
  ADD COLUMN IF NOT EXISTS correo_asunto text,
  ADD COLUMN IF NOT EXISTS correo_remitente text,
  ADD COLUMN IF NOT EXISTS correo_cuerpo text,
  ADD COLUMN IF NOT EXISTS correo_firma text;

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS texto_bienvenida text,
  ADD COLUMN IF NOT EXISTS aviso_respuestas text,
  ADD COLUMN IF NOT EXISTS correo_asunto text,
  ADD COLUMN IF NOT EXISTS correo_remitente text,
  ADD COLUMN IF NOT EXISTS correo_cuerpo text,
  ADD COLUMN IF NOT EXISTS correo_firma text,
  ADD COLUMN IF NOT EXISTS bloque_comercial text,
  ADD COLUMN IF NOT EXISTS bloque_comercial_url text,
  ADD COLUMN IF NOT EXISTS bloque_comercial_etiqueta text,
  ADD COLUMN IF NOT EXISTS minutos smallint;

ALTER TABLE public.fase
  DROP CONSTRAINT IF EXISTS fase_minutos_rango;

ALTER TABLE public.fase
  ADD CONSTRAINT fase_minutos_rango CHECK (
    minutos IS NULL OR (minutos >= 1 AND minutos <= 240)
  );

ALTER TABLE public.fase
  DROP CONSTRAINT IF EXISTS fase_bloque_url_https;

ALTER TABLE public.fase
  ADD CONSTRAINT fase_bloque_url_https CHECK (
    bloque_comercial_url IS NULL OR bloque_comercial_url ~ '^https://[^[:space:]]+$'
  );
