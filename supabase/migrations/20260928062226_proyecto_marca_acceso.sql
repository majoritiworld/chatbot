-- White-label entry and per-project membership.
--
-- usuario.proyecto_id stays the home project for the existing portal and
-- cliente policies. It is not the authorization source of a project link.
-- proyecto_acceso is one permission per email and project. The same email can
-- belong to several projects without moving or erasing the original row.
-- Stakeholder emails are unique inside a project, not across the whole portal.

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS nombre_publico text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS color_principal text,
  ADD COLUMN IF NOT EXISTS titulo_iniciativa text,
  ADD COLUMN IF NOT EXISTS texto_bienvenida text,
  ADD COLUMN IF NOT EXISTS contacto_nombre text,
  ADD COLUMN IF NOT EXISTS contacto_email text;

CREATE UNIQUE INDEX IF NOT EXISTS proyecto_slug_idx
  ON public.proyecto (slug)
  WHERE slug IS NOT NULL;

CREATE TABLE public.proyecto_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  email text NOT NULL,
  rol public.user_rol NOT NULL DEFAULT 'stakeholder',
  usuario_id uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proyecto_acceso_rol_portal CHECK (rol IN ('stakeholder', 'cliente')),
  CONSTRAINT proyecto_acceso_email_normalizado CHECK (
    email = lower(btrim(email)) AND length(email) > 0
  ),
  CONSTRAINT proyecto_acceso_proyecto_email_key UNIQUE (proyecto_id, email)
);

CREATE INDEX proyecto_acceso_email_idx
  ON public.proyecto_acceso (email);

ALTER TABLE public.proyecto_acceso ENABLE ROW LEVEL SECURITY;

CREATE POLICY proyecto_acceso_majoriti_all ON public.proyecto_acceso
  FOR ALL TO authenticated
  USING ((SELECT private.is_majoriti()))
  WITH CHECK ((SELECT private.is_majoriti()));

CREATE POLICY proyecto_acceso_select_propio ON public.proyecto_acceso
  FOR SELECT TO authenticated
  USING (
    email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

DROP INDEX IF EXISTS public.stakeholder_email_idx;

CREATE UNIQUE INDEX stakeholder_proyecto_email_idx
  ON public.stakeholder (proyecto_id, lower(email));

-- Rebuilds missing permissions from stakeholders and portal profiles.
-- A second run does not insert duplicates and does not change a role that
-- already exists, so a later cliente/stakeholder choice is left in place.
CREATE OR REPLACE FUNCTION private.cargar_proyecto_acceso()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proyecto_acceso (proyecto_id, email, rol, usuario_id)
  SELECT
    s.proyecto_id,
    lower(btrim(s.email)),
    CASE
      WHEN u.rol = 'cliente' AND u.proyecto_id = s.proyecto_id THEN 'cliente'::public.user_rol
      ELSE 'stakeholder'::public.user_rol
    END,
    u.id
  FROM public.stakeholder s
  LEFT JOIN public.usuario u
    ON lower(btrim(u.email)) = lower(btrim(s.email))
  WHERE nullif(btrim(s.email), '') IS NOT NULL
  ON CONFLICT (proyecto_id, email) DO NOTHING;

  INSERT INTO public.proyecto_acceso (proyecto_id, email, rol, usuario_id)
  SELECT u.proyecto_id, lower(btrim(u.email)), u.rol, u.id
  FROM public.usuario u
  WHERE u.proyecto_id IS NOT NULL
    AND u.rol IN ('cliente', 'stakeholder')
    AND nullif(btrim(u.email), '') IS NOT NULL
  ON CONFLICT (proyecto_id, email) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION private.cargar_proyecto_acceso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.cargar_proyecto_acceso() TO postgres, service_role;

SELECT private.cargar_proyecto_acceso();

CREATE OR REPLACE FUNCTION private.sync_proyecto_acceso_stakeholder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  email_anterior text;
  email_nuevo text := lower(btrim(coalesce(NEW.email, '')));
BEGIN
  -- Keep an existing role on the same project when only the address changes.
  -- Never move that row to another project: a cliente permission must stay
  -- where it was granted.
  IF TG_OP = 'UPDATE' THEN
    email_anterior := lower(btrim(coalesce(OLD.email, '')));

    IF OLD.proyecto_id IS NOT DISTINCT FROM NEW.proyecto_id
      AND email_anterior IS DISTINCT FROM email_nuevo
      AND email_nuevo <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.proyecto_acceso AS ocupado
        WHERE ocupado.proyecto_id = NEW.proyecto_id
          AND ocupado.email = email_nuevo
      )
    THEN
      UPDATE public.proyecto_acceso
      SET email = email_nuevo
      WHERE proyecto_id = OLD.proyecto_id
        AND email = email_anterior;
    END IF;

    IF OLD.proyecto_id IS DISTINCT FROM NEW.proyecto_id THEN
      DELETE FROM public.proyecto_acceso
      WHERE proyecto_id = OLD.proyecto_id
        AND email = email_anterior
        AND rol = 'stakeholder'
        AND NOT EXISTS (
          SELECT 1
          FROM public.stakeholder AS otro
          WHERE otro.proyecto_id = OLD.proyecto_id
            AND lower(btrim(otro.email)) = email_anterior
            AND otro.id IS DISTINCT FROM NEW.id
        );
    END IF;
  END IF;

  IF email_nuevo <> '' THEN
    INSERT INTO public.proyecto_acceso (proyecto_id, email, rol)
    VALUES (NEW.proyecto_id, email_nuevo, 'stakeholder')
    ON CONFLICT (proyecto_id, email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_proyecto_acceso_stakeholder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.sync_proyecto_acceso_stakeholder() TO postgres, service_role;

DROP TRIGGER IF EXISTS stakeholder_sync_proyecto_acceso ON public.stakeholder;
CREATE TRIGGER stakeholder_sync_proyecto_acceso
  AFTER INSERT OR UPDATE OF email, proyecto_id ON public.stakeholder
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_proyecto_acceso_stakeholder();

-- True only when this session's email owns that stakeholder row and has
-- permission on its project. A membership in another project does not match.
CREATE OR REPLACE FUNCTION private.stakeholder_es_propio(p_stakeholder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stakeholder AS s
    JOIN public.proyecto_acceso AS acceso
      ON acceso.proyecto_id = s.proyecto_id
     AND acceso.email = lower(btrim(s.email))
    WHERE s.id = p_stakeholder_id
      AND lower(btrim(s.email)) = lower(btrim(coalesce((SELECT auth.jwt()) ->> 'email', '')))
      AND acceso.rol IN ('stakeholder', 'cliente')
  );
$$;

REVOKE ALL ON FUNCTION private.stakeholder_es_propio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.stakeholder_es_propio(uuid) TO authenticated, service_role;

CREATE POLICY entrevista_acceso_select ON public.entrevista
  FOR SELECT TO authenticated
  USING (private.stakeholder_es_propio(stakeholder_id));

CREATE POLICY entrevista_acceso_update ON public.entrevista
  FOR UPDATE TO authenticated
  USING (private.stakeholder_es_propio(stakeholder_id))
  WITH CHECK (private.stakeholder_es_propio(stakeholder_id));

CREATE POLICY respuesta_acceso_select ON public.respuesta
  FOR SELECT TO authenticated
  USING (
    entrevista_id IN (
      SELECT e.id
      FROM public.entrevista AS e
      WHERE private.stakeholder_es_propio(e.stakeholder_id)
    )
  );

CREATE POLICY respuesta_acceso_insert ON public.respuesta
  FOR INSERT TO authenticated
  WITH CHECK (
    entrevista_id IN (
      SELECT e.id
      FROM public.entrevista AS e
      WHERE private.stakeholder_es_propio(e.stakeholder_id)
    )
  );

CREATE POLICY stakeholder_acceso_select ON public.stakeholder
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
    AND EXISTS (
      SELECT 1
      FROM public.proyecto_acceso AS acceso
      WHERE acceso.proyecto_id = stakeholder.proyecto_id
        AND acceso.email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
    )
  );

CREATE POLICY proyecto_miembro_select ON public.proyecto
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT acceso.proyecto_id
      FROM public.proyecto_acceso AS acceso
      WHERE acceso.email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('marcas', 'marcas', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS marcas_majoriti_all ON storage.objects;
CREATE POLICY marcas_majoriti_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'marcas' AND (SELECT private.is_majoriti()))
  WITH CHECK (bucket_id = 'marcas' AND (SELECT private.is_majoriti()));


-- Interview RPCs authorize the stakeholder row of this interview,
-- not the single id returned for an email.

CREATE OR REPLACE FUNCTION public.append_interview_turns(
  p_entrevista_id uuid,
  p_turnos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  nuevos_turnos jsonb;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR entrevista_row.estado <> 'abierta'
    OR (
      NOT private.stakeholder_es_propio(entrevista_row.stakeholder_id)
      AND NOT private.is_majoriti()
    )
    OR jsonb_typeof(p_turnos) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_turnos) AS turno
      WHERE jsonb_typeof(turno) <> 'object'
        OR coalesce(turno ->> 'id', '') = ''
        OR coalesce(turno ->> 'texto', '') = ''
        OR turno ->> 'rol' NOT IN ('entrevistador', 'entrevistado')
    )
  THEN
    RAISE EXCEPTION 'Invalid interview turns';
  END IF;

  SELECT coalesce(jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
  INTO nuevos_turnos
  FROM jsonb_array_elements(p_turnos) WITH ORDINALITY AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista_row.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  UPDATE public.entrevista AS e
  SET
    transcripcion = e.transcripcion || nuevos_turnos,
    ultima_actividad = now()
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista_row.stakeholder_id
    AND estado_entrevista = 'pendiente';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_interview_section(
  p_entrevista_id uuid,
  p_seccion_id text,
  p_completion jsonb,
  p_transcripcion jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  active_section_id text;
  new_turns jsonb;
  next_index integer;
  next_state text;
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR (
      NOT private.stakeholder_es_propio(entrevista_row.stakeholder_id)
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista_row.secciones_completadas) AS completed
    WHERE completed ->> 'seccionId' = p_seccion_id
  ) THEN
    RETURN jsonb_build_object(
      'flujoEstado', entrevista_row.flujo_estado,
      'seccionActual', entrevista_row.seccion_actual,
      'seccionId', p_seccion_id
    );
  END IF;

  active_section_id :=
    entrevista_row.secciones -> entrevista_row.seccion_actual ->> 'id';

  IF entrevista_row.estado <> 'abierta'
    OR entrevista_row.flujo_estado <> 'chat'
    OR active_section_id IS DISTINCT FROM p_seccion_id
    OR p_completion ->> 'seccionId' IS DISTINCT FROM p_seccion_id
    OR coalesce(p_completion ->> 'sintesis', '') = ''
    OR p_completion ->> 'modo' NOT IN ('agente', 'manual')
    OR jsonb_typeof(p_completion -> 'hallazgos') <> 'array'
    OR jsonb_typeof(p_completion -> 'respuestas') <> 'array'
    OR jsonb_typeof(p_transcripcion) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_transcripcion) AS turno
      WHERE jsonb_typeof(turno) <> 'object'
        OR coalesce(turno ->> 'id', '') = ''
        OR coalesce(turno ->> 'texto', '') = ''
        OR turno ->> 'rol' NOT IN ('entrevistador', 'entrevistado')
        OR turno ->> 'seccionId' IS DISTINCT FROM p_seccion_id
    )
  THEN
    RAISE EXCEPTION 'Interview section changed';
  END IF;

  SELECT coalesce(jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
  INTO new_turns
  FROM jsonb_array_elements(p_transcripcion) WITH ORDINALITY AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(entrevista_row.transcripcion) AS existing
    WHERE existing ->> 'id' = candidate.value ->> 'id'
  );

  next_index := entrevista_row.seccion_actual + 1;
  next_state := CASE
    WHEN next_index < jsonb_array_length(entrevista_row.secciones)
      THEN 'presentacion'
    ELSE 'revision'
  END;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET
    flujo_estado = next_state,
    seccion_actual = next_index,
    secciones_completadas =
      e.secciones_completadas || jsonb_build_array(p_completion),
    transcripcion = e.transcripcion || new_turns,
    ultima_actividad = now()
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'en_curso'
  WHERE id = entrevista_row.stakeholder_id
    AND estado_entrevista = 'pendiente';

  RETURN jsonb_build_object(
    'flujoEstado', next_state,
    'seccionActual', next_index,
    'seccionId', p_seccion_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_interview(
  p_entrevista_id uuid,
  p_resumen jsonb,
  p_respuestas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
  ahora timestamptz := now();
BEGIN
  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR (
      NOT private.stakeholder_es_propio(entrevista_row.stakeholder_id)
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF entrevista_row.estado = 'completada' THEN
    RETURN jsonb_build_object('alreadyDone', true);
  END IF;

  IF entrevista_row.estado <> 'abierta'
    OR entrevista_row.flujo_estado <> 'revision'
    OR jsonb_typeof(p_respuestas) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(entrevista_row.secciones) AS section
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(entrevista_row.secciones_completadas) AS completed
        WHERE completed ->> 'seccionId' = section ->> 'id'
      )
    )
  THEN
    RAISE EXCEPTION 'Interview is not ready to submit';
  END IF;

  INSERT INTO public.respuesta (
    entrevista_id,
    pregunta,
    respuesta_texto
  )
  SELECT
    p_entrevista_id,
    response ->> 'pregunta',
    response ->> 'respuesta_texto'
  FROM jsonb_array_elements(p_respuestas) AS response;

  INSERT INTO public.respuesta (
    entrevista_id,
    pregunta,
    respuesta_texto
  )
  VALUES (
    p_entrevista_id,
    '__resumen__',
    COALESCE(p_resumen ->> 'sintesis', '')
  );

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista AS e
  SET
    estado = 'completada',
    fecha_completada = ahora,
    resumen = p_resumen,
    ultima_actividad = ahora
  WHERE e.id = p_entrevista_id;

  UPDATE public.stakeholder
  SET estado_entrevista = 'completada'
  WHERE id = entrevista_row.stakeholder_id;

  RETURN jsonb_build_object('alreadyDone', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_interview_flow(
  p_entrevista_id uuid,
  p_desde text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
  destino text;
BEGIN
  IF p_desde NOT IN ('bienvenida', 'presentacion') THEN
    RAISE EXCEPTION 'Invalid interview transition';
  END IF;

  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR (
      NOT private.stakeholder_es_propio(entrevista.stakeholder_id)
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF entrevista.estado <> 'abierta'
    OR entrevista.flujo_estado <> p_desde
    OR jsonb_array_length(entrevista.secciones) = 0
  THEN
    RAISE EXCEPTION 'Interview changed';
  END IF;

  destino := CASE
    WHEN p_desde = 'bienvenida' THEN 'presentacion'
    ELSE 'chat'
  END;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET flujo_estado = destino
  WHERE id = p_entrevista_id;

  RETURN jsonb_build_object('flujoEstado', destino);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_interview_thank_you_sent(
  p_entrevista_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entrevista public.entrevista%ROWTYPE;
BEGIN
  SELECT * INTO entrevista
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista.id IS NULL
    OR entrevista.estado <> 'completada'
    OR (
      NOT private.stakeholder_es_propio(entrevista.stakeholder_id)
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET correo_agradecimiento_en = COALESCE(correo_agradecimiento_en, now())
  WHERE id = p_entrevista_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_interview_notion_synced(
  p_entrevista_id uuid,
  p_page_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  entrevista_row public.entrevista%ROWTYPE;
BEGIN
  IF p_page_id IS NULL OR length(trim(p_page_id)) = 0 THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  SELECT * INTO entrevista_row
  FROM public.entrevista
  WHERE id = p_entrevista_id
  FOR UPDATE;

  IF entrevista_row.id IS NULL
    OR entrevista_row.estado <> 'completada'
    OR (
      NOT private.stakeholder_es_propio(entrevista_row.stakeholder_id)
      AND NOT private.is_majoriti()
    )
  THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  PERFORM set_config('app.interview_transition', 'allowed', true);
  UPDATE public.entrevista
  SET notion_transcripcion_id = COALESCE(notion_transcripcion_id, trim(p_page_id))
  WHERE id = p_entrevista_id;
END;
$$;

-- Older participant policies authorize the first stakeholder row of an email.
-- They ignore proyecto_acceso, so revoking a membership would still allow
-- reading and writing that interview. The policies above replace them.
DROP POLICY IF EXISTS entrevista_propia_update ON public.entrevista;
DROP POLICY IF EXISTS entrevista_stakeholder_select ON public.entrevista;
DROP POLICY IF EXISTS entrevista_stakeholder_update ON public.entrevista;
DROP POLICY IF EXISTS respuesta_propia_insert ON public.respuesta;
DROP POLICY IF EXISTS respuesta_stakeholder_insert ON public.respuesta;
DROP POLICY IF EXISTS respuesta_stakeholder_select ON public.respuesta;
DROP POLICY IF EXISTS stakeholder_propia_update ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_stakeholder_select ON public.stakeholder;
DROP POLICY IF EXISTS stakeholder_stakeholder_update ON public.stakeholder;
DROP POLICY IF EXISTS proyecto_stakeholder_select ON public.proyecto;
DROP POLICY IF EXISTS documento_stakeholder_select ON public.documento;

CREATE POLICY documento_miembro_select ON public.documento
  FOR SELECT TO authenticated
  USING (
    visibilidad IN ('stakeholder', 'publico')
    AND EXISTS (
      SELECT 1
      FROM public.proyecto_acceso AS acceso
      WHERE acceso.proyecto_id = documento.proyecto_id
        AND acceso.email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
    )
  );
