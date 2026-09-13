-- Applied via Supabase MCP (consultoria_schema_rls).
-- Source of truth mirror for local reference.

CREATE TYPE public.user_rol AS ENUM ('majoriti', 'cliente', 'firma_socia', 'comite');

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
