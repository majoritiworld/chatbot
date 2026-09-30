-- Two ways into one interview without a Supabase session, both phase settings:
--   acceso_enlace_personal: a personal link opens that interview.
--   acceso_solo_correo: typing the assigned email opens that interview.
-- Either one authorizes only that interview; roles never come with it.

ALTER TABLE public.fase
  ADD COLUMN IF NOT EXISTS acceso_enlace_personal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acceso_solo_correo boolean NOT NULL DEFAULT false;

-- Phases that already issued links keep them working.
UPDATE public.fase AS fase
SET acceso_enlace_personal = true
WHERE NOT fase.acceso_enlace_personal
  AND EXISTS (
    SELECT 1
    FROM public.tarea AS tarea
    JOIN public.entrevista_enlace AS enlace
      ON enlace.entrevista_id = tarea.entrevista_id
    WHERE tarea.fase_id = fase.id
      AND tarea.tipo = 'entrevista'
  );

-- Accepted decision: knowing the email of a partner-firm participant is
-- enough to open that interview. Only this phase of this project.
UPDATE public.fase AS fase
SET acceso_solo_correo = true
FROM public.proyecto AS proyecto
WHERE proyecto.id = fase.proyecto_id
  AND proyecto.slug = 'compliance-latam'
  AND fase.nombre = 'Entrevistas a Firmas Socias'
  AND NOT fase.acceso_solo_correo;

CREATE OR REPLACE FUNCTION private.enlace_personal_vigente(
  p_entrevista_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.entrevista_enlace AS enlace
    JOIN public.entrevista AS entrevista
      ON entrevista.id = enlace.entrevista_id
    JOIN public.stakeholder AS stakeholder
      ON stakeholder.id = entrevista.stakeholder_id
    JOIN public.tarea AS tarea
      ON tarea.entrevista_id = entrevista.id
     AND tarea.tipo = 'entrevista'
    JOIN public.fase AS fase
      ON fase.id = tarea.fase_id
    WHERE enlace.entrevista_id = p_entrevista_id
      AND enlace.revocado_en IS NULL
      AND fase.acceso_enlace_personal
      AND lower(btrim(stakeholder.email)) = lower(btrim(p_email))
  );
$$;

CREATE OR REPLACE FUNCTION private.acceso_solo_correo_vigente(
  p_entrevista_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.entrevista AS entrevista
    JOIN public.stakeholder AS stakeholder
      ON stakeholder.id = entrevista.stakeholder_id
    JOIN public.tarea AS tarea
      ON tarea.entrevista_id = entrevista.id
     AND tarea.tipo = 'entrevista'
    JOIN public.fase AS fase
      ON fase.id = tarea.fase_id
     AND fase.proyecto_id = stakeholder.proyecto_id
    WHERE entrevista.id = p_entrevista_id
      AND fase.acceso_solo_correo
      AND lower(btrim(stakeholder.email)) = lower(btrim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION private.enlace_personal_vigente(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.acceso_solo_correo_vigente(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Interviews an email may open without a code in one project. Server only.
CREATE OR REPLACE FUNCTION public.entrevistas_acceso_solo_correo(
  p_slug text,
  p_email text
)
RETURNS TABLE (entrevista_id uuid, fase_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT entrevista.id, fase.id
  FROM public.proyecto AS proyecto
  JOIN public.fase AS fase
    ON fase.proyecto_id = proyecto.id
   AND fase.acceso_solo_correo
  JOIN public.tarea AS tarea
    ON tarea.fase_id = fase.id
   AND tarea.tipo = 'entrevista'
  JOIN public.entrevista AS entrevista
    ON entrevista.id = tarea.entrevista_id
  JOIN public.stakeholder AS stakeholder
    ON stakeholder.id = entrevista.stakeholder_id
   AND stakeholder.proyecto_id = proyecto.id
  WHERE proyecto.slug = lower(btrim(p_slug))
    AND length(btrim(coalesce(p_email, ''))) > 0
    AND lower(btrim(stakeholder.email)) = lower(btrim(p_email));
$$;

REVOKE ALL ON FUNCTION public.entrevistas_acceso_solo_correo(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.entrevistas_acceso_solo_correo(text, text) TO service_role;

CREATE OR REPLACE FUNCTION private.sesion_puede_operar_entrevista(p_stakeholder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  email_enlace text;
  id_enlace text;
  email_sesion text;
BEGIN
  email_enlace := nullif(current_setting('app.enlace_email', true), '');
  id_enlace := nullif(current_setting('app.enlace_id', true), '');

  -- Set only inside the service-role *_enlace wrappers, for this transaction.
  IF email_enlace IS NOT NULL AND id_enlace IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.entrevista AS entrevista
      WHERE entrevista.id = id_enlace::uuid
        AND entrevista.stakeholder_id = p_stakeholder_id
    ) AND (
      private.enlace_personal_vigente(id_enlace::uuid, email_enlace)
      OR private.acceso_solo_correo_vigente(id_enlace::uuid, email_enlace)
    );
  END IF;

  IF auth.uid() IS NULL OR p_stakeholder_id IS NULL THEN
    RETURN false;
  END IF;

  IF private.is_majoriti() THEN
    RETURN true;
  END IF;

  SELECT lower(btrim(users.email))
  INTO email_sesion
  FROM auth.users AS users
  WHERE users.id = auth.uid();

  IF email_sesion IS NULL OR email_sesion = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.stakeholder AS stakeholder
    JOIN public.proyecto_acceso AS acceso
      ON acceso.proyecto_id = stakeholder.proyecto_id
     AND acceso.email = lower(btrim(stakeholder.email))
    WHERE stakeholder.id = p_stakeholder_id
      AND lower(btrim(stakeholder.email)) = email_sesion
      AND acceso.rol IN ('stakeholder', 'cliente')
  );
END;
$$;

REVOKE ALL ON FUNCTION private.sesion_puede_operar_entrevista(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sesion_puede_operar_entrevista(uuid) FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_interview_notion_synced_enlace(p_entrevista_id uuid, p_page_id text, p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_page_id IS NULL OR length(trim(p_page_id)) = 0 OR p_email IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.entrevista AS entrevista
    WHERE entrevista.id = p_entrevista_id
      AND entrevista.estado = 'completada'
  ) OR NOT (
    private.enlace_personal_vigente(p_entrevista_id, p_email)
    OR private.acceso_solo_correo_vigente(p_entrevista_id, p_email)
  ) THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET notion_transcripcion_id = COALESCE(notion_transcripcion_id, trim(p_page_id))
  WHERE id = p_entrevista_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_interview_notion_synced_enlace(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_interview_notion_synced_enlace(uuid, text, text) TO service_role;

-- The simplified session has no Supabase user. The thank-you stamp still goes
-- through the same check, so a portal session is not required and a second
-- call does not move the timestamp.
CREATE OR REPLACE FUNCTION public.mark_interview_thank_you_sent_enlace(
  p_entrevista_id uuid,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_email IS NULL OR length(btrim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.enlace_email', lower(btrim(p_email)), true);
  PERFORM set_config('app.enlace_id', p_entrevista_id::text, true);
  PERFORM public.mark_interview_thank_you_sent(p_entrevista_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_interview_thank_you_sent_enlace(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_interview_thank_you_sent_enlace(uuid, text) TO service_role;
