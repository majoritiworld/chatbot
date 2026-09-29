# Reparación de la pauta de fase 2 (29 de septiembre de 2026)

Estado: publicado. **Pendiente: comprobación manual en navegador** (la hace el equipo; ver abajo).

## Fallo

La presentación de cada tema mostraba al participante las instrucciones internas del agente (reglas, prioridades y menú de seguimientos), porque el guion las guardaba en `descripcion`. El prompt, además, imponía «Tutea (tú)» y obligaba a cubrir todas las preguntas guía. En la entrevista de prueba el agente reescribió la pregunta aprobada en tú.

## Corrección

- Commit `350eb8a`, deploy `dpl_BPiknd8seLzMuhm6AccmLRmx9ETF` en `portal.majoriti.world`.
- Cada sección separa descripción pública, pregunta principal, instrucciones internas y seguimientos opcionales. Las reglas comunes y el trato viven en `entrevista.instrucciones_agente` y `entrevista.trato` (también en la plantilla).
- El flujo elige como máximo dos seguimientos por sección, descarta los ya respondidos y ofrece el cierre cuando no queda nada. Fase 1 y los demás guiones reciben el mismo prompt que antes.
- Migración `20260929200000_instrucciones_agente_entrevista`, aplicada con esa misma versión (sin `db push`).
- Reparación de la plantilla `6a23d7e6-3f83-4db3-9d61-a6914359b08a` y sus 36 copias: SQL exacto en `evidencia/reparacion-pauta-fase-2/reparacion-aplicada.sql`, generado por `lib/consultoria/reparaciones/pauta-cl-fase-2.ts`.

## Validado

- `pnpm test:unit`: 164 pruebas, incluida `tests/unit/reparacion-pauta-fase-2.test.ts` (conserva respuestas, estados y consentimiento; no toca fase 1 ni copias editadas; el participante no puede cambiar trato ni instrucciones).
- Huellas md5 en producción antes y después de la reparación: idénticas para lo conservado de las 36 copias (`350bd46c…`), el resto de entrevistas (`2ea1d845…`) y el resto de plantillas (`cdb47390…`). 0 descripciones con reglas del agente en toda la base. Ningún correo enviado.
- Conversaciones con el modelo de producción: `evidencia/reparacion-pauta-fase-2/conversaciones-modelo-final.txt`. `conversaciones-solo-prompt.txt` muestra los fallos que tenía la versión que solo ajustaba el prompt (repetía lo respondido, botón y pregunta en el mismo turno).
- No se validó en navegador.

## Pendiente: comprobación manual

1. Las cinco presentaciones de fase 2 muestran solo una frase introductoria.
2. Admin → plantilla de fase 2: instrucciones y seguimientos en «Solo para el agente», trato «Usted»; «Guardar guion» guarda sin error.
3. Una entrevista de prueba: usted en todo momento, pregunta principal primero, como máximo dos seguimientos, botón con texto y «Cerrar y continuar» avanza.
4. La entrevista «PRUEBA Seba» queda como estaba (sección 2, con la conversación anterior en tú). No se modificó.

## Mejoras opcionales (para después)

- Textos generales del portal en tú («podrás», «Puedes pausar»). La fase admite un texto de bienvenida propio.
- La evaluación previa de seguimientos añade cerca de un segundo por turno.
- Dos avisos de formato previos en `components/chat/multimodal-input.tsx` y `components/portal/entrevista-voz-compositor.tsx`.
