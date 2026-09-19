-- Auditoría de solo lectura para la estabilización de entrevistas.
-- No consulta filas de negocio ni datos personales. No muestra secretos.
-- Ejecutar en el SQL Editor del proyecto destino (staging o producción
-- verificados). No aplica migraciones ni cambia privilegios.
--
-- Resultados esperados DESPUÉS de aplicar
-- supabase/migrations/20260919090000_restrict_profile_updates.sql:
--   1) schema_migrations incluye version 20260919090000 / restrict_profile_updates.
--   2) public.usuario tiene RLS activo.
--   3) Políticas de usuario: usuario_select_self_or_majoriti (SELECT) y
--      usuario_all_majoriti (ALL). No debe existir usuario_update_self_or_majoriti.
--   4) Ninguna otra política en public.usuario debe permitir UPDATE/INSERT/DELETE
--      a quien no sea Majoriti.
--   5) authenticated conserva UPDATE (lo usa usuario_all_majoriti).
--      anon puede seguir teniendo GRANT de escritura: sin política, RLS lo bloquea.
--   6) Las únicas funciones que referencian public.usuario deben ser los helpers
--      private (lectura) y private.handle_new_user (INSERT al crear Auth).
--
-- Si 20260919090000 no aparece, la política de auto-actualización sigue vigente
-- aunque el código de la aplicación ya esté desplegado.

BEGIN TRANSACTION READ ONLY;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitado,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'usuario';

SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check,
  CASE
    WHEN policyname IN (
      'usuario_select_self_or_majoriti',
      'usuario_all_majoriti'
    ) THEN 'esperada'
    WHEN policyname = 'usuario_update_self_or_majoriti' THEN 'debe_eliminarse'
    ELSE 'no_esta_en_el_repositorio'
  END AS evaluacion
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'usuario'
ORDER BY policyname;

SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'usuario'
  AND cmd IN ('UPDATE', 'INSERT', 'DELETE', 'ALL')
  AND policyname <> 'usuario_all_majoriti'
ORDER BY policyname;

SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'usuario'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY grantee, privilege_type;

SELECT
  n.nspname AS esquema,
  p.proname AS funcion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ILIKE '%public.usuario%'
ORDER BY n.nspname, p.proname;

SELECT t.tgname, pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'usuario'
  AND NOT t.tgisinternal;

SELECT schemaname, viewname
FROM pg_views
WHERE definition ILIKE '%public.usuario%'
ORDER BY schemaname, viewname;

SELECT
  n.nspname AS esquema,
  c.relname AS relacion,
  p.polname AS politica,
  p.polcmd AS cmd
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage')
  AND (
    pg_get_expr(p.polqual, p.polrelid) ILIKE '%public.usuario%'
    OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%public.usuario%'
  )
ORDER BY n.nspname, c.relname, p.polname;

ROLLBACK;
