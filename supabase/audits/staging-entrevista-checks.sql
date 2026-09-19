-- Comprobaciones de staging con cuentas *@example.test.
-- No usar personas reales. Restaura proyecto_id aunque el UPDATE falle.
-- ROLLBACK es la red de seguridad. Solo lee proyecto_id, nunca email ni nombre.

BEGIN;

SELECT set_config('app.participant_id', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.participant_email', 'participante@example.test', true);
SELECT set_config('app.other_id', '00000000-0000-4000-8000-000000000002', true);
SELECT set_config('app.majoriti_id', '00000000-0000-4000-8000-000000000003', true);
SELECT set_config('app.project_id', '00000000-0000-4000-8000-000000000004', true);
SELECT set_config('app.foreign_interview_id', '00000000-0000-4000-8000-000000000005', true);

DO $$
BEGIN
  IF current_setting('app.participant_id') LIKE '00000000-%' THEN
    RAISE EXCEPTION 'Reemplaza los UUID de prueba antes de ejecutar este script';
  END IF;
  IF current_setting('app.participant_email') NOT LIKE '%@example.test' THEN
    RAISE EXCEPTION 'Solo cuentas *@example.test. No uses correos de clientes.';
  END IF;
END;
$$;

SELECT proyecto_id AS original_project
FROM public.usuario
WHERE id = current_setting('app.participant_id')::uuid;

SELECT set_config('app.original_project', coalesce(proyecto_id::text, ''), true)
FROM public.usuario
WHERE id = current_setting('app.participant_id')::uuid;

SELECT set_config('request.jwt.claim.sub', current_setting('app.participant_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'email', current_setting('app.participant_email'),
    'sub', current_setting('app.participant_id')
  )::text,
  true
);
SET ROLE authenticated;

WITH changed AS (
  UPDATE public.usuario
  SET rol = 'majoriti', proyecto_id = current_setting('app.project_id')::uuid
  WHERE id = current_setting('app.participant_id')::uuid
  RETURNING 1
)
SELECT 'self_role_or_project' AS check_id, count(*) AS changed_rows
FROM changed;

WITH changed AS (
  UPDATE public.usuario
  SET rol = 'majoriti'
  WHERE id = current_setting('app.other_id')::uuid
  RETURNING 1
)
SELECT 'other_profile' AS check_id, count(*) AS changed_rows
FROM changed;

DO $$
BEGIN
  BEGIN
    PERFORM public.append_interview_turns(
      current_setting('app.foreign_interview_id')::uuid,
      '[{"id":"staging-foreign","rol":"entrevistado","texto":"no","seccionId":null}]'::jsonb
    );
    RAISE EXCEPTION 'foreign_append_should_fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'foreign_append_should_fail' THEN
        RAISE;
      END IF;
  END;
END;
$$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', current_setting('app.majoriti_id'), true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('app.majoriti_id'))::text,
  true
);
SET ROLE authenticated;

WITH changed AS (
  UPDATE public.usuario
  SET proyecto_id = current_setting('app.project_id')::uuid
  WHERE id = current_setting('app.participant_id')::uuid
  RETURNING 1
)
SELECT 'majoriti_assign_project' AS check_id, count(*) AS changed_rows
FROM changed;

RESET ROLE;

UPDATE public.usuario
SET proyecto_id = nullif(current_setting('app.original_project'), '')::uuid
WHERE id = current_setting('app.participant_id')::uuid;

DO $$
BEGIN
  IF (
    SELECT proyecto_id::text
    FROM public.usuario
    WHERE id = current_setting('app.participant_id')::uuid
  ) IS DISTINCT FROM nullif(current_setting('app.original_project'), '') THEN
    RAISE EXCEPTION 'No se restauró proyecto_id de la cuenta de prueba';
  END IF;
END;
$$;

ROLLBACK;
