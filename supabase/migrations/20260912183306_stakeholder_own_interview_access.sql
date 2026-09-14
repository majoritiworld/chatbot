-- Cliente (Colomba, Rodrigo, Yoab, …): project portal, read-only progress.
-- Stakeholder (firma socia and later guests): only their own interview.
-- Role renamed from firma_socia so it is not tied to one client type.

DROP POLICY IF EXISTS proyecto_firma_select ON public.proyecto;
DROP POLICY IF EXISTS fase_firma_select ON public.fase;
DROP POLICY IF EXISTS tarea_firma_select ON public.tarea;
DROP POLICY IF EXISTS stakeholder_firma_select ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_firma_update ON public.stakeholder;
DROP POLICY IF EXISTS entrevista_firma_select ON public.entrevista;
DROP POLICY IF EXISTS entrevista_firma_update ON public.entrevista;
DROP POLICY IF EXISTS documento_firma_select ON public.documento;
DROP POLICY IF EXISTS respuesta_firma_select ON public.respuesta;
DROP POLICY IF EXISTS respuesta_firma_insert ON public.respuesta;
DROP POLICY IF EXISTS entrevista_cliente_update ON public.entrevista;
DROP POLICY IF EXISTS stakeholder_cliente_update ON public.stakeholder;

ALTER TYPE public.user_rol RENAME VALUE 'firma_socia' TO 'stakeholder';

ALTER TABLE public.usuario
  ALTER COLUMN rol SET DEFAULT 'stakeholder';

UPDATE public.documento
  SET visibilidad = 'stakeholder'
  WHERE visibilidad = 'firma_socia';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_rol public.user_rol;
BEGIN
  assigned_rol := coalesce(
    (NEW.raw_app_meta_data ->> 'role')::public.user_rol,
    'stakeholder'
  );

  INSERT INTO public.usuario (id, nombre, email, rol)
  VALUES (
    NEW.id,
    coalesce(
      NEW.raw_user_meta_data ->> 'nombre',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    assigned_rol
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE POLICY proyecto_stakeholder_select ON public.proyecto
  FOR SELECT
  USING (
    public.current_user_rol() = 'stakeholder'
    AND id = (
      SELECT s.proyecto_id
      FROM public.stakeholder s
      WHERE s.id = public.own_stakeholder_id()
    )
  );

CREATE POLICY stakeholder_stakeholder_select ON public.stakeholder
  FOR SELECT
  USING (
    public.current_user_rol() = 'stakeholder'
    AND id = public.own_stakeholder_id()
  );

CREATE POLICY stakeholder_stakeholder_update ON public.stakeholder
  FOR UPDATE
  USING (
    public.current_user_rol() = 'stakeholder'
    AND id = public.own_stakeholder_id()
  )
  WITH CHECK (
    public.current_user_rol() = 'stakeholder'
    AND id = public.own_stakeholder_id()
  );

CREATE POLICY entrevista_stakeholder_select ON public.entrevista
  FOR SELECT
  USING (
    public.current_user_rol() = 'stakeholder'
    AND stakeholder_id = public.own_stakeholder_id()
  );

CREATE POLICY entrevista_stakeholder_update ON public.entrevista
  FOR UPDATE
  USING (
    public.current_user_rol() = 'stakeholder'
    AND stakeholder_id = public.own_stakeholder_id()
  )
  WITH CHECK (
    public.current_user_rol() = 'stakeholder'
    AND stakeholder_id = public.own_stakeholder_id()
  );

CREATE POLICY documento_stakeholder_select ON public.documento
  FOR SELECT
  USING (
    public.current_user_rol() = 'stakeholder'
    AND visibilidad = ANY (ARRAY['stakeholder'::text, 'publico'::text])
    AND proyecto_id = (
      SELECT s.proyecto_id
      FROM public.stakeholder s
      WHERE s.id = public.own_stakeholder_id()
    )
  );

CREATE POLICY respuesta_stakeholder_select ON public.respuesta
  FOR SELECT
  USING (
    public.current_user_rol() = 'stakeholder'
    AND entrevista_id IN (
      SELECT e.id
      FROM public.entrevista e
      WHERE e.stakeholder_id = public.own_stakeholder_id()
    )
  );

CREATE POLICY respuesta_stakeholder_insert ON public.respuesta
  FOR INSERT
  WITH CHECK (
    public.current_user_rol() = 'stakeholder'
    AND entrevista_id IN (
      SELECT e.id
      FROM public.entrevista e
      WHERE e.stakeholder_id = public.own_stakeholder_id()
    )
  );
