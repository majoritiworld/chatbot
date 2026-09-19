-- Comprobaciones de staging con tres cuentas exclusivas de prueba.
-- No usar personas de clientes. Restaura proyecto_id aunque el UPDATE falle.
-- ROLLBACK es la red de seguridad.
-- Sustituye allowed_emails / allowed_ids y los UUID/correos antes de ejecutar.

BEGIN;

SELECT set_config(
  'app.allowed_emails',
  'qa-participante@tu-buzon.invalid,qa-otro@tu-buzon.invalid,qa-majoriti@tu-buzon.invalid',
  true
);
SELECT set_config(
  'app.allowed_ids',
  '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000003',
  true
);
SELECT set_config('app.participant_id', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.participant_email', 'qa-participante@tu-buzon.invalid', true);
SELECT set_config('app.other_id', '00000000-0000-4000-8000-000000000002', true);
SELECT set_config('app.other_email', 'qa-otro@tu-buzon.invalid', true);
SELECT set_config('app.majoriti_id', '00000000-0000-4000-8000-000000000003', true);
SELECT set_config('app.majoriti_email', 'qa-majoriti@tu-buzon.invalid', true);
SELECT set_config('app.project_id', '00000000-0000-4000-8000-000000000004', true);
SELECT set_config('app.foreign_interview_id', '00000000-0000-4000-8000-000000000005', true);

DO $$
DECLARE
  allowed_emails text[];
  allowed_ids uuid[];
  participant_email text;
  other_email text;
  majoriti_email text;
  participant_id uuid;
  other_id uuid;
  majoriti_id uuid;
  row_email text;
BEGIN
  IF current_setting('app.participant_id') LIKE '00000000-%' THEN
    RAISE EXCEPTION 'Reemplaza los UUID y correos de prueba antes de ejecutar este script';
  END IF;

  allowed_emails := ARRAY(
    SELECT trim(email)
    FROM unnest(string_to_array(lower(current_setting('app.allowed_emails')), ',')) AS email
    WHERE trim(email) <> ''
  );
  allowed_ids := ARRAY(
    SELECT trim(id)::uuid
    FROM unnest(string_to_array(lower(current_setting('app.allowed_ids')), ',')) AS id
    WHERE trim(id) <> ''
  );
  participant_email := lower(trim(current_setting('app.participant_email')));
  other_email := lower(trim(current_setting('app.other_email')));
  majoriti_email := lower(trim(current_setting('app.majoriti_email')));
  participant_id := current_setting('app.participant_id')::uuid;
  other_id := current_setting('app.other_id')::uuid;
  majoriti_id := current_setting('app.majoriti_id')::uuid;

  IF (
    SELECT count(DISTINCT email)
    FROM unnest(allowed_emails) AS email
  ) <> 3 OR (
    SELECT count(DISTINCT id)
    FROM unnest(allowed_ids) AS id
  ) <> 3 THEN
    RAISE EXCEPTION 'La lista autorizada debe tener exactamente tres correos y tres UUID distintos';
  END IF;

  IF participant_email LIKE '%@example.com'
    OR participant_email LIKE '%.test'
    OR other_email LIKE '%@example.com'
    OR other_email LIKE '%.test'
    OR majoriti_email LIKE '%@example.com'
    OR majoriti_email LIKE '%.test' THEN
    RAISE EXCEPTION 'Usa buzones reales. No uses dominios de documentación ni *@example.test.';
  END IF;

  IF participant_email <> ALL (allowed_emails)
    OR other_email <> ALL (allowed_emails)
    OR majoriti_email <> ALL (allowed_emails)
    OR participant_id <> ALL (allowed_ids)
    OR other_id <> ALL (allowed_ids)
    OR majoriti_id <> ALL (allowed_ids) THEN
    RAISE EXCEPTION 'Hay una cuenta fuera de la lista autorizada. No uses cuentas de clientes.';
  END IF;

  SELECT lower(email) INTO row_email
  FROM public.usuario
  WHERE id = participant_id;
  IF row_email IS DISTINCT FROM participant_email THEN
    RAISE EXCEPTION 'El UUID del participante no corresponde al correo autorizado';
  END IF;

  SELECT lower(email) INTO row_email
  FROM public.usuario
  WHERE id = other_id;
  IF row_email IS DISTINCT FROM other_email THEN
    RAISE EXCEPTION 'El UUID de la segunda cuenta no corresponde al correo autorizado';
  END IF;

  SELECT lower(email) INTO row_email
  FROM public.usuario
  WHERE id = majoriti_id;
  IF row_email IS DISTINCT FROM majoriti_email THEN
    RAISE EXCEPTION 'El UUID de Majoriti no corresponde al correo autorizado';
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
  json_build_object(
    'email', current_setting('app.majoriti_email'),
    'sub', current_setting('app.majoriti_id')
  )::text,
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
