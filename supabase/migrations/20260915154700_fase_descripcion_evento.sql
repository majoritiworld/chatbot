-- Phase copy for the client portal, plus project-level calendar events.

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS descripcion text;

CREATE TABLE public.evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  fecha date NOT NULL,
  participantes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evento_proyecto_id_idx ON public.evento (proyecto_id);
CREATE INDEX evento_proyecto_fecha_idx ON public.evento (proyecto_id, fecha);

ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY evento_majoriti_all ON public.evento
  FOR ALL
  TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY evento_cliente_select ON public.evento
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND proyecto_id = (SELECT private.current_user_proyecto_id())
  );

CREATE POLICY evento_comite_select ON public.evento
  FOR SELECT
  TO authenticated
  USING ((SELECT private.current_user_rol()) = 'comite');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'evento'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.evento;
  END IF;
END $$;
