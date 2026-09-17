-- Given name and family name stored apart so later copy can address
-- someone by first name only.

ALTER TABLE public.stakeholder
  ADD COLUMN IF NOT EXISTS apellido text;

UPDATE public.stakeholder
SET
  apellido = NULLIF(btrim(regexp_replace(btrim(nombre), '^\S+\s*', '')), ''),
  nombre = btrim(split_part(btrim(nombre), ' ', 1))
WHERE btrim(nombre) ~ '\s';
