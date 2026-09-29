-- Country and job title travel with the person. They are not permissions.
-- Existing rows stay empty until a load writes the delivered text.

ALTER TABLE public.stakeholder
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS cargo text;
