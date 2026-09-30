-- Collaborator interviews are opened with a personal link plus the invited email.

ALTER TABLE public.stakeholder
  ADD COLUMN IF NOT EXISTS industria text;

CREATE TABLE IF NOT EXISTS public.entrevista_enlace (
  entrevista_id uuid PRIMARY KEY REFERENCES public.entrevista (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_cifrado text NOT NULL,
  revocado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invitacion_envio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES public.entrevista (id) ON DELETE CASCADE,
  correo text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('enviado', 'error')),
  detalle text,
  enviado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invitacion_envio_una_enviada
  ON public.invitacion_envio (entrevista_id)
  WHERE estado = 'enviado';

CREATE TABLE IF NOT EXISTS public.carga_incidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id uuid NOT NULL REFERENCES public.fase (id) ON DELETE CASCADE,
  hoja text NOT NULL,
  fila integer NOT NULL,
  motivo text NOT NULL,
  detalle text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entrevista_enlace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitacion_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carga_incidencia ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.entrevista_enlace FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.entrevista_enlace TO service_role;

DROP POLICY IF EXISTS invitacion_envio_admin ON public.invitacion_envio;
CREATE POLICY invitacion_envio_admin
  ON public.invitacion_envio
  FOR SELECT
  TO authenticated
  USING (private.is_majoriti());

DROP POLICY IF EXISTS carga_incidencia_admin ON public.carga_incidencia;
CREATE POLICY carga_incidencia_admin
  ON public.carga_incidencia
  FOR SELECT
  TO authenticated
  USING (private.is_majoriti());

REVOKE ALL ON TABLE public.invitacion_envio FROM anon;
REVOKE ALL ON TABLE public.carga_incidencia FROM anon;
GRANT SELECT ON TABLE public.invitacion_envio TO authenticated;
GRANT SELECT ON TABLE public.carga_incidencia TO authenticated;
GRANT ALL ON TABLE public.invitacion_envio TO service_role;
GRANT ALL ON TABLE public.carga_incidencia TO service_role;

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS invitacion_asunto text,
  ADD COLUMN IF NOT EXISTS invitacion_cuerpo text;

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS invitacion_asunto text,
  ADD COLUMN IF NOT EXISTS invitacion_cuerpo text;
