-- Start/end date range for each project phase.

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS fecha_cierre date;

ALTER TABLE public.fase
  DROP CONSTRAINT IF EXISTS fase_fecha_cierre_rango_chk;

ALTER TABLE public.fase
  ADD CONSTRAINT fase_fecha_cierre_rango_chk
  CHECK (
    fecha_cierre IS NULL
    OR fecha_estimada IS NULL
    OR fecha_cierre >= fecha_estimada
  );
