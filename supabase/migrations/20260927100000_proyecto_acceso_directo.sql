-- When true, invited people of this project sign in with their email only.

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS acceso_directo boolean NOT NULL DEFAULT false;
