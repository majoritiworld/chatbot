-- Move SECURITY DEFINER helpers out of the Data API schema, restrict
-- previously PUBLIC policies to authenticated, wrap auth.uid() for RLS,
-- and index remaining foreign keys.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

CREATE OR REPLACE FUNCTION private.current_user_rol()
RETURNS public.user_rol
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rol FROM public.usuario WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.current_user_proyecto_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT proyecto_id FROM public.usuario WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_majoriti()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario
    WHERE id = (SELECT auth.uid()) AND rol = 'majoriti'
  );
$$;

CREATE OR REPLACE FUNCTION private.own_stakeholder_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.stakeholder s
  WHERE lower(s.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION private.current_user_rol() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_proyecto_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_majoriti() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.own_stakeholder_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.current_user_rol() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_user_proyecto_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_majoriti() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.own_stakeholder_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.handle_new_user() TO postgres, service_role;

DROP POLICY IF EXISTS documento_cliente_select ON public.documento;
DROP POLICY IF EXISTS documento_majoriti_all ON public.documento;
DROP POLICY IF EXISTS documento_stakeholder_select ON public.documento;
DROP POLICY IF EXISTS entrevista_cliente_select ON public.entrevista;
DROP POLICY IF EXISTS entrevista_majoriti_all ON public.entrevista;
DROP POLICY IF EXISTS entrevista_propia_update ON public.entrevista;
DROP POLICY IF EXISTS entrevista_stakeholder_select ON public.entrevista;
DROP POLICY IF EXISTS entrevista_stakeholder_update ON public.entrevista;
DROP POLICY IF EXISTS entrevista_plantilla_majoriti_all ON public.entrevista_plantilla;
DROP POLICY IF EXISTS fase_cliente_select ON public.fase;
DROP POLICY IF EXISTS fase_comite_select ON public.fase;
DROP POLICY IF EXISTS fase_majoriti_all ON public.fase;
DROP POLICY IF EXISTS metrica_cliente_select ON public.metrica;
DROP POLICY IF EXISTS metrica_comite_select ON public.metrica;
DROP POLICY IF EXISTS metrica_majoriti_all ON public.metrica;
DROP POLICY IF EXISTS proyecto_cliente_select ON public.proyecto;
DROP POLICY IF EXISTS proyecto_comite_select ON public.proyecto;
DROP POLICY IF EXISTS proyecto_majoriti_all ON public.proyecto;
DROP POLICY IF EXISTS proyecto_stakeholder_select ON public.proyecto;
DROP POLICY IF EXISTS respuesta_cliente_select ON public.respuesta;
DROP POLICY IF EXISTS respuesta_majoriti_all ON public.respuesta;
DROP POLICY IF EXISTS respuesta_propia_insert ON public.respuesta;
DROP POLICY IF EXISTS respuesta_stakeholder_insert ON public.respuesta;
DROP POLICY IF EXISTS respuesta_stakeholder_select ON public.respuesta;
DROP POLICY IF EXISTS stakeholder_cliente_select ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_majoriti_all ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_propia_update ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_stakeholder_select ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_stakeholder_update ON public.stakeholder;
DROP POLICY IF EXISTS tarea_cliente_select ON public.tarea;
DROP POLICY IF EXISTS tarea_majoriti_all ON public.tarea;
DROP POLICY IF EXISTS usuario_all_majoriti ON public.usuario;
DROP POLICY IF EXISTS usuario_select_self_or_majoriti ON public.usuario;
DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario;
DROP POLICY IF EXISTS documentos_majoriti_all ON storage.objects;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.current_user_rol();
DROP FUNCTION IF EXISTS public.current_user_proyecto_id();
DROP FUNCTION IF EXISTS public.is_majoriti();
DROP FUNCTION IF EXISTS public.own_stakeholder_id();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE POLICY usuario_select_self_or_majoriti ON public.usuario
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_majoriti()));

CREATE POLICY usuario_update_self_or_majoriti ON public.usuario
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_majoriti()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT private.is_majoriti()));

CREATE POLICY usuario_all_majoriti ON public.usuario
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY proyecto_majoriti_all ON public.proyecto
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY proyecto_cliente_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND id = (SELECT private.current_user_proyecto_id())
  );

CREATE POLICY proyecto_comite_select ON public.proyecto
  FOR SELECT TO authenticated
  USING ((SELECT private.current_user_rol()) = 'comite');

CREATE POLICY proyecto_stakeholder_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND id = (
      SELECT s.proyecto_id
      FROM public.stakeholder s
      WHERE s.id = (SELECT private.own_stakeholder_id())
    )
  );

CREATE POLICY fase_majoriti_all ON public.fase
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY fase_cliente_select ON public.fase
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND proyecto_id = (SELECT private.current_user_proyecto_id())
  );

CREATE POLICY fase_comite_select ON public.fase
  FOR SELECT TO authenticated
  USING ((SELECT private.current_user_rol()) = 'comite');

CREATE POLICY tarea_majoriti_all ON public.tarea
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY tarea_cliente_select ON public.tarea
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND fase_id IN (
      SELECT f.id FROM public.fase f
      WHERE f.proyecto_id = (SELECT private.current_user_proyecto_id())
    )
  );

CREATE POLICY stakeholder_majoriti_all ON public.stakeholder
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY stakeholder_cliente_select ON public.stakeholder
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND proyecto_id = (SELECT private.current_user_proyecto_id())
  );

CREATE POLICY stakeholder_stakeholder_select ON public.stakeholder
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND id = (SELECT private.own_stakeholder_id())
  );

CREATE POLICY stakeholder_stakeholder_update ON public.stakeholder
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND id = (SELECT private.own_stakeholder_id())
  )
  WITH CHECK (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND id = (SELECT private.own_stakeholder_id())
  );

CREATE POLICY stakeholder_propia_update ON public.stakeholder
  FOR UPDATE TO authenticated
  USING (id = (SELECT private.own_stakeholder_id()))
  WITH CHECK (id = (SELECT private.own_stakeholder_id()));

CREATE POLICY entrevista_majoriti_all ON public.entrevista
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY entrevista_cliente_select ON public.entrevista
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND stakeholder_id IN (
      SELECT s.id FROM public.stakeholder s
      WHERE s.proyecto_id = (SELECT private.current_user_proyecto_id())
    )
  );

CREATE POLICY entrevista_stakeholder_select ON public.entrevista
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND stakeholder_id = (SELECT private.own_stakeholder_id())
  );

CREATE POLICY entrevista_stakeholder_update ON public.entrevista
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND stakeholder_id = (SELECT private.own_stakeholder_id())
  )
  WITH CHECK (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND stakeholder_id = (SELECT private.own_stakeholder_id())
  );

CREATE POLICY entrevista_propia_update ON public.entrevista
  FOR UPDATE TO authenticated
  USING (stakeholder_id = (SELECT private.own_stakeholder_id()))
  WITH CHECK (stakeholder_id = (SELECT private.own_stakeholder_id()));

CREATE POLICY respuesta_majoriti_all ON public.respuesta
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY respuesta_cliente_select ON public.respuesta
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND entrevista_id IN (
      SELECT e.id
      FROM public.entrevista e
      JOIN public.stakeholder s ON s.id = e.stakeholder_id
      WHERE s.proyecto_id = (SELECT private.current_user_proyecto_id())
    )
  );

CREATE POLICY respuesta_stakeholder_select ON public.respuesta
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND entrevista_id IN (
      SELECT e.id FROM public.entrevista e
      WHERE e.stakeholder_id = (SELECT private.own_stakeholder_id())
    )
  );

CREATE POLICY respuesta_stakeholder_insert ON public.respuesta
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND entrevista_id IN (
      SELECT e.id FROM public.entrevista e
      WHERE e.stakeholder_id = (SELECT private.own_stakeholder_id())
    )
  );

CREATE POLICY respuesta_propia_insert ON public.respuesta
  FOR INSERT TO authenticated
  WITH CHECK (
    entrevista_id IN (
      SELECT e.id FROM public.entrevista e
      WHERE e.stakeholder_id = (SELECT private.own_stakeholder_id())
    )
  );

CREATE POLICY metrica_majoriti_all ON public.metrica
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY metrica_cliente_select ON public.metrica
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND proyecto_id = (SELECT private.current_user_proyecto_id())
  );

CREATE POLICY metrica_comite_select ON public.metrica
  FOR SELECT TO authenticated
  USING ((SELECT private.current_user_rol()) = 'comite');

CREATE POLICY documento_majoriti_all ON public.documento
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY documento_cliente_select ON public.documento
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'cliente'
    AND proyecto_id = (SELECT private.current_user_proyecto_id())
    AND visibilidad = ANY (ARRAY['cliente'::text, 'publico'::text])
  );

CREATE POLICY documento_stakeholder_select ON public.documento
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_user_rol()) = 'stakeholder'
    AND visibilidad = ANY (ARRAY['stakeholder'::text, 'publico'::text])
    AND proyecto_id = (
      SELECT s.proyecto_id
      FROM public.stakeholder s
      WHERE s.id = (SELECT private.own_stakeholder_id())
    )
  );

CREATE POLICY entrevista_plantilla_majoriti_all ON public.entrevista_plantilla
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY documentos_majoriti_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documentos' AND (SELECT private.is_majoriti()))
  WITH CHECK (bucket_id = 'documentos' AND (SELECT private.is_majoriti()));

CREATE INDEX IF NOT EXISTS metrica_proyecto_id_idx ON public.metrica (proyecto_id);
CREATE INDEX IF NOT EXISTS respuesta_entrevista_id_idx ON public.respuesta (entrevista_id);
CREATE INDEX IF NOT EXISTS usuario_proyecto_id_idx ON public.usuario (proyecto_id);
