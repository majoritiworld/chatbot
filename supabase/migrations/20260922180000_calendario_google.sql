-- Google Calendar connection for Majoriti, and the ids that attach a
-- Granola note to the portal date the admin chose.

ALTER TABLE public.evento
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS granola_note_id text;

CREATE UNIQUE INDEX IF NOT EXISTS evento_google_event_id_idx
  ON public.evento (google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE TABLE public.calendario_google (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuario(id) ON DELETE CASCADE,
  email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendario_google ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_google FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.calendario_google FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.calendario_google TO service_role;
