-- Optional context from the participant base. It is data for the interview,
-- not a permission. Existing people stay empty until a load writes it.

ALTER TABLE public.stakeholder
  ADD COLUMN IF NOT EXISTS descripcion text;
