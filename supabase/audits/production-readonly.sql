-- Paso 2: inventario de esquema; no consulta entrevistas ni datos personales.
-- Ejecutar en el SQL Editor del proyecto Supabase conectado a producción.
BEGIN TRANSACTION READ ONLY;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

SELECT c.relname AS tabla, c.relrowsecurity AS rls_habilitado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT p.proname, pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.proname IN ('current_user_rol', 'current_user_proyecto_id',
                   'own_stakeholder_id', 'is_majoriti', 'handle_new_user');

SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;

SELECT e.enumlabel AS rol
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'user_rol'
ORDER BY e.enumsortorder;

SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

ROLLBACK;
