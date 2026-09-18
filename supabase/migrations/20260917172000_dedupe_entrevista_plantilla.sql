-- Opening a phase used maybeSingle() to find the seeded guide. Concurrent
-- loads created duplicate templates and then crashed with PGRST116.

WITH keepers AS (
  SELECT DISTINCT ON (p.proyecto_id, p.fase_id, p.nombre)
    p.id,
    p.proyecto_id,
    p.fase_id,
    p.nombre
  FROM public.entrevista_plantilla p
  LEFT JOIN (
    SELECT plantilla_id, count(*) AS cnt
    FROM public.entrevista
    WHERE plantilla_id IS NOT NULL
    GROUP BY plantilla_id
  ) e ON e.plantilla_id = p.id
  ORDER BY
    p.proyecto_id,
    p.fase_id,
    p.nombre,
    coalesce(e.cnt, 0) DESC,
    p.created_at ASC,
    p.id ASC
)
UPDATE public.entrevista entrevista
SET plantilla_id = keepers.id
FROM public.entrevista_plantilla dup
JOIN keepers
  ON keepers.proyecto_id = dup.proyecto_id
 AND keepers.fase_id = dup.fase_id
 AND keepers.nombre = dup.nombre
WHERE entrevista.plantilla_id = dup.id
  AND entrevista.plantilla_id IS DISTINCT FROM keepers.id;

WITH keepers AS (
  SELECT DISTINCT ON (p.proyecto_id, p.fase_id, p.nombre)
    p.id,
    p.proyecto_id,
    p.fase_id,
    p.nombre
  FROM public.entrevista_plantilla p
  LEFT JOIN (
    SELECT plantilla_id, count(*) AS cnt
    FROM public.entrevista
    WHERE plantilla_id IS NOT NULL
    GROUP BY plantilla_id
  ) e ON e.plantilla_id = p.id
  ORDER BY
    p.proyecto_id,
    p.fase_id,
    p.nombre,
    coalesce(e.cnt, 0) DESC,
    p.created_at ASC,
    p.id ASC
)
DELETE FROM public.entrevista_plantilla dup
USING keepers
WHERE dup.proyecto_id = keepers.proyecto_id
  AND dup.fase_id = keepers.fase_id
  AND dup.nombre = keepers.nombre
  AND dup.id <> keepers.id;

CREATE UNIQUE INDEX IF NOT EXISTS entrevista_plantilla_proyecto_fase_nombre_uidx
  ON public.entrevista_plantilla (proyecto_id, fase_id, nombre);
