-- Roles
CREATE TYPE public.user_rol AS ENUM ('majoriti', 'cliente', 'firma_socia', 'comite');

-- Core tables
CREATE TABLE public.proyecto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cliente text NOT NULL,
  fase_actual text,
  fecha_comite date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_estimada date
);

CREATE TABLE public.tarea (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id uuid NOT NULL REFERENCES public.fase(id) ON DELETE CASCADE,
  responsable text,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_limite date
);

CREATE TABLE public.usuario (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  email text NOT NULL UNIQUE,
  rol public.user_rol NOT NULL DEFAULT 'firma_socia',
  proyecto_id uuid REFERENCES public.proyecto(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stakeholder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  firma text,
  email text NOT NULL,
  estado_entrevista text NOT NULL DEFAULT 'pendiente'
);

CREATE UNIQUE INDEX stakeholder_email_idx ON public.stakeholder (lower(email));

CREATE TABLE public.entrevista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id uuid NOT NULL REFERENCES public.stakeholder(id) ON DELETE CASCADE,
  preguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado text NOT NULL DEFAULT 'abierta',
  fecha_completada timestamptz
);

CREATE TABLE public.respuesta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrevista_id uuid NOT NULL REFERENCES public.entrevista(id) ON DELETE CASCADE,
  pregunta text NOT NULL,
  respuesta_texto text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.metrica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  valor numeric,
  fuente text,
  fecha date,
  brecha_bool boolean NOT NULL DEFAULT false
);

CREATE TABLE public.documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  link text NOT NULL,
  visibilidad text NOT NULL DEFAULT 'interno'
);

-- Helpers for RLS (SECURITY DEFINER, not exposed for writes)
CREATE OR REPLACE FUNCTION public.current_user_rol()
RETURNS public.user_rol
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.usuario WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_proyecto_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT proyecto_id FROM public.usuario WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_majoriti()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario WHERE id = auth.uid() AND rol = 'majoriti'
  );
$$;

CREATE OR REPLACE FUNCTION public.own_stakeholder_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.stakeholder s
  WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$;

-- Auto-create usuario on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_rol public.user_rol;
BEGIN
  assigned_rol := coalesce(
    (NEW.raw_app_meta_data ->> 'role')::public.user_rol,
    'firma_socia'
  );

  INSERT INTO public.usuario (id, nombre, email, rol)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'nombre', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    assigned_rol
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrevista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuesta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento ENABLE ROW LEVEL SECURITY;

-- usuario policies
CREATE POLICY usuario_select_self_or_majoriti ON public.usuario
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_majoriti());

CREATE POLICY usuario_update_self_or_majoriti ON public.usuario
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_majoriti())
  WITH CHECK (id = auth.uid() OR public.is_majoriti());

CREATE POLICY usuario_all_majoriti ON public.usuario
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

-- proyecto
CREATE POLICY proyecto_majoriti_all ON public.proyecto
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY proyecto_cliente_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND id = public.current_user_proyecto_id()
  );

CREATE POLICY proyecto_comite_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (public.current_user_rol() = 'comite');

CREATE POLICY proyecto_firma_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND id IN (
      SELECT s.proyecto_id FROM public.stakeholder s
      WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- fase
CREATE POLICY fase_majoriti_all ON public.fase
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY fase_cliente_select ON public.fase
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
  );

CREATE POLICY fase_comite_select ON public.fase
  FOR SELECT TO authenticated
  USING (public.current_user_rol() = 'comite');

-- tarea
CREATE POLICY tarea_majoriti_all ON public.tarea
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY tarea_cliente_select ON public.tarea
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND fase_id IN (
      SELECT f.id FROM public.fase f WHERE f.proyecto_id = public.current_user_proyecto_id()
    )
  );

-- stakeholder
CREATE POLICY stakeholder_majoriti_all ON public.stakeholder
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY stakeholder_cliente_select ON public.stakeholder
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
  );

CREATE POLICY stakeholder_firma_select ON public.stakeholder
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- entrevista
CREATE POLICY entrevista_majoriti_all ON public.entrevista
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY entrevista_cliente_select ON public.entrevista
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND stakeholder_id IN (
      SELECT s.id FROM public.stakeholder s WHERE s.proyecto_id = public.current_user_proyecto_id()
    )
  );

CREATE POLICY entrevista_firma_select ON public.entrevista
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND stakeholder_id = public.own_stakeholder_id()
  );

CREATE POLICY entrevista_firma_update ON public.entrevista
  FOR UPDATE TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND stakeholder_id = public.own_stakeholder_id()
  )
  WITH CHECK (
    public.current_user_rol() = 'firma_socia'
    AND stakeholder_id = public.own_stakeholder_id()
  );

-- respuesta
CREATE POLICY respuesta_majoriti_all ON public.respuesta
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY respuesta_cliente_select ON public.respuesta
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND entrevista_id IN (
      SELECT e.id FROM public.entrevista e
      JOIN public.stakeholder s ON s.id = e.stakeholder_id
      WHERE s.proyecto_id = public.current_user_proyecto_id()
    )
  );

CREATE POLICY respuesta_firma_select ON public.respuesta
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND entrevista_id IN (
      SELECT e.id FROM public.entrevista e WHERE e.stakeholder_id = public.own_stakeholder_id()
    )
  );

CREATE POLICY respuesta_firma_insert ON public.respuesta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_rol() IN ('firma_socia', 'cliente', 'majoriti')
    AND (
      public.is_majoriti()
      OR public.current_user_rol() = 'cliente'
      OR entrevista_id IN (
        SELECT e.id FROM public.entrevista e WHERE e.stakeholder_id = public.own_stakeholder_id()
      )
    )
  );

-- metrica: majoriti CRUD, cliente own project, comite read-only
CREATE POLICY metrica_majoriti_all ON public.metrica
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY metrica_cliente_select ON public.metrica
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
  );

CREATE POLICY metrica_comite_select ON public.metrica
  FOR SELECT TO authenticated
  USING (public.current_user_rol() = 'comite');

-- documento
CREATE POLICY documento_majoriti_all ON public.documento
  FOR ALL TO authenticated
  USING (public.is_majoriti())
  WITH CHECK (public.is_majoriti());

CREATE POLICY documento_cliente_select ON public.documento
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'
    AND proyecto_id = public.current_user_proyecto_id()
    AND visibilidad IN ('cliente', 'publico')
  );

CREATE POLICY documento_firma_select ON public.documento
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'firma_socia'
    AND visibilidad IN ('firma_socia', 'publico')
    AND proyecto_id IN (
      SELECT s.proyecto_id FROM public.stakeholder s
      WHERE lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Seed demo project + interview
WITH p AS (
  INSERT INTO public.proyecto (id, nombre, cliente, fase_actual, fecha_comite)
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Transformación Comercial ACME',
    'ACME Corp',
    'Diagnóstico',
    CURRENT_DATE + 30
  )
  RETURNING id
),
f AS (
  INSERT INTO public.fase (proyecto_id, nombre, orden, estado, fecha_estimada)
  SELECT id, 'Diagnóstico', 1, 'en_curso', CURRENT_DATE + 14 FROM p
  RETURNING id, proyecto_id
),
s AS (
  INSERT INTO public.stakeholder (id, proyecto_id, nombre, firma, email, estado_entrevista)
  SELECT
    '22222222-2222-2222-2222-222222222222',
    p.id,
    'Ana Stakeholder',
    'Socio Comercial',
    'ana.stakeholder@example.com',
    'pendiente'
  FROM p
  RETURNING id
)
INSERT INTO public.entrevista (id, stakeholder_id, preguntas, estado)
SELECT
  '33333333-3333-3333-3333-333333333333',
  s.id,
  jsonb_build_array(
    '¿Cuál es el principal desafío comercial de tu área hoy?',
    '¿Cómo miden actualmente el impacto de las iniciativas?',
    '¿Qué stakeholders deben estar alineados para el éxito del proyecto?',
    '¿Qué riesgo ves si no se actúa en los próximos 90 días?'
  ),
  'abierta'
FROM s;

INSERT INTO public.metrica (proyecto_id, nombre, valor, fuente, fecha, brecha_bool)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'NPS interno',
  42,
  'Encuesta Q1',
  CURRENT_DATE,
  true
);
