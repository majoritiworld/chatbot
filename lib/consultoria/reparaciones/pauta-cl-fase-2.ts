import {
  GUION_CL_FASE_2,
  INSTRUCCIONES_AGENTE_CL_FASE_2,
  NOMBRE_PLANTILLA_CL_FASE_2,
  TRATO_CL_FASE_2,
} from "@/lib/consultoria/guiones/compliance-latam-fase-2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves the agent rules out of the public description of the phase 2 guide,
 * in the template and in every interview copied from it. Section ids,
 * answers, flow state and consent stay untouched. A copy whose titles or main
 * questions were edited by hand is skipped, so other guides are not
 * overwritten. Running it twice leaves the same result.
 */
export function sqlReparacionPautaClFase2(plantillaId: string) {
  if (!UUID.test(plantillaId)) {
    throw new Error("plantillaId debe ser un UUID");
  }

  const nuevas = JSON.stringify(
    GUION_CL_FASE_2.map((seccion) => ({
      descripcion: seccion.descripcion,
      ...(seccion.instrucciones
        ? { instrucciones: seccion.instrucciones }
        : {}),
      maxSeguimientos: seccion.maxSeguimientos,
      preguntas: seccion.preguntas,
      seguimientos: seccion.seguimientos,
      titulo: seccion.titulo,
    }))
  );

  const coincide = (columna: string) => `(
      jsonb_array_length(${columna}) = jsonb_array_length(nuevas)
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(${columna}) WITH ORDINALITY AS viejo(sv, i)
        JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
        WHERE viejo.sv ->> 'titulo' IS DISTINCT FROM nuevo.sn ->> 'titulo'
          OR viejo.sv -> 'preguntas' IS DISTINCT FROM nuevo.sn -> 'preguntas'
      )
    )`;

  const fusion = (columna: string) => `(
      SELECT jsonb_agg(
        (viejo.sv - 'descripcion' - 'instrucciones' - 'seguimientos' - 'preguntas' - 'titulo')
          || nuevo.sn
        ORDER BY i
      )
      FROM jsonb_array_elements(${columna}) WITH ORDINALITY AS viejo(sv, i)
      JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
    )`;

  return `DO $reparacion$
DECLARE
  nuevas jsonb := $json$${nuevas}$json$::jsonb;
  instrucciones text := $txt$${INSTRUCCIONES_AGENTE_CL_FASE_2}$txt$;
  plantillas integer;
BEGIN
  PERFORM set_config('app.interview_transition', 'allowed', true);

  UPDATE public.entrevista_plantilla AS p
  SET secciones = ${fusion("p.secciones")},
    instrucciones_agente = instrucciones,
    trato = '${TRATO_CL_FASE_2}'
  WHERE p.id = '${plantillaId}'
    AND ${coincide("p.secciones")};
  GET DIAGNOSTICS plantillas = ROW_COUNT;
  IF plantillas <> 1 THEN
    RAISE EXCEPTION 'La plantilla % no coincide con la pauta aprobada', '${plantillaId}';
  END IF;

  UPDATE public.entrevista AS e
  SET secciones = ${fusion("e.secciones")},
    instrucciones_agente = instrucciones,
    trato = '${TRATO_CL_FASE_2}'
  WHERE e.plantilla_id = '${plantillaId}'
    AND ${coincide("e.secciones")};
END
$reparacion$;`;
}

function guionJson() {
  return JSON.stringify(
    GUION_CL_FASE_2.map((seccion) => ({
      descripcion: seccion.descripcion,
      ...(seccion.instrucciones
        ? { instrucciones: seccion.instrucciones }
        : {}),
      maxSeguimientos: seccion.maxSeguimientos,
      preguntas: seccion.preguntas,
      seguimientos: seccion.seguimientos,
      titulo: seccion.titulo,
    }))
  );
}

/**
 * Updates the partner-firm guide's questions, follow-ups and cap on the
 * template and on open copies. Section ids, transcripts and completed
 * interviews stay as they are. A copy is recognized by the five titles, so a
 * changed opening question is still updated. Running it twice leaves the same
 * result.
 */
export function sqlProfundidadFirmasSocias() {
  const nuevas = guionJson();
  const mismosTitulos = (columna: string) => `(
      jsonb_array_length(${columna}) = jsonb_array_length(nuevas)
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(${columna}) WITH ORDINALITY AS viejo(sv, i)
        JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
        WHERE viejo.sv ->> 'titulo' IS DISTINCT FROM nuevo.sn ->> 'titulo'
      )
    )`;
  const fusion = (columna: string) => `(
      SELECT jsonb_agg(
        (viejo.sv - 'descripcion' - 'instrucciones' - 'seguimientos' - 'preguntas' - 'titulo' - 'maxSeguimientos')
          || nuevo.sn
        ORDER BY i
      )
      FROM jsonb_array_elements(${columna}) WITH ORDINALITY AS viejo(sv, i)
      JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
    )`;
  const nombre = NOMBRE_PLANTILLA_CL_FASE_2.replaceAll("'", "''");

  return `DO $profundidad$
DECLARE
  nuevas jsonb := $json$${nuevas}$json$::jsonb;
  instrucciones text := $txt$${INSTRUCCIONES_AGENTE_CL_FASE_2}$txt$;
  plantillas integer;
BEGIN
  PERFORM set_config('app.interview_transition', 'allowed', true);

  UPDATE public.entrevista_plantilla AS p
  SET secciones = ${fusion("p.secciones")},
    instrucciones_agente = instrucciones,
    trato = '${TRATO_CL_FASE_2}'
  WHERE p.nombre = '${nombre}'
    AND ${mismosTitulos("p.secciones")};
  GET DIAGNOSTICS plantillas = ROW_COUNT;
  IF plantillas < 1 THEN
    RAISE EXCEPTION 'No hay una plantilla de firmas socias con los títulos de la pauta';
  END IF;

  UPDATE public.entrevista AS e
  SET secciones = ${fusion("e.secciones")},
    instrucciones_agente = instrucciones,
    trato = '${TRATO_CL_FASE_2}'
  WHERE e.plantilla_id IN (
      SELECT p.id
      FROM public.entrevista_plantilla AS p
      WHERE p.nombre = '${nombre}'
    )
    AND e.estado = 'abierta'
    AND e.flujo_estado IN ('bienvenida', 'presentacion', 'chat')
    AND ${mismosTitulos("e.secciones")};
END
$profundidad$;`;
}
