-- Project blurb shown under the title in the client portal.

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS descripcion text;
