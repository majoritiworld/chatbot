# Experiencia de entrevista — piloto de 15

Candidato: rama `piloto/entrevista-esfuerzo` desde `origin/main`. No mezcla trabajo de admin ni de rendimiento.

## Qué conserva Guardar

`POST /api/entrevista/guardar` envía los **mensajes ya presentes en el chat** de la sección activa y el RPC `append_interview_turns` los fusiona por **ID de turno**. No cierra el tema ni entrega la entrevista.

No guarda:

- el texto del compositor que todavía no se envió (borrador);
- un guardado o un turno de chat que aún está en curso.

El envío de una respuesta por el compositor persiste ese turno **antes** de llamar al modelo. Guardar sirve para confirmar el flush de lo ya hablado al salir, no como almacén de borradores. No se guarda texto sensible en `localStorage` ni en cookies.

`beforeunload` y la confirmación al pulsar «Fases» son avisos del navegador o de la propia app. No garantizan que el borrador sobreviva.

## Consentimiento

La pantalla de entrevista solo se omite si existe `entrevista.consentimiento_en`. Tener mensajes en la transcripción **no** sustituye el consentimiento.

El chat exige el mismo sello. Un historial previo sin consentimiento no autoriza a seguir respondiendo.

El texto de uso de respuestas se conserva (almacenamiento para ComplianceLatam, revisión de Majoriti, posibilidad de guardar y continuar). No se añadieron promesas nuevas sobre quién ve las respuestas.

### Ambigüedad de acceso (para revisión, no resuelta aquí)

La copy dice que las respuestas se guardan «de forma exclusiva para ComplianceLatam» y que Majoriti las revisa. En el producto, quien puede leer depende de RLS y de las pantallas: el participante dueño, cuentas Majoriti en admin, y posiblemente quien tenga `service_role`. Eso no es lo mismo que un aislamiento contractual «solo ComplianceLatam». Hay que revisar copy legal y permisos reales aparte de este piloto.

## Avance inicial

Tras confirmar consentimiento se encadenan solo transiciones RPC vigentes: `bienvenida` → `presentacion` y, en el **primer** tema (`seccion_actual === 0`), `presentacion` → `chat`. Los temas siguientes siguen mostrando la presentación corta. Un fallo intermedio deja el estado servidor y muestra reintento; no se monta el compositor hasta `flujo_estado === "chat"`.

## Entrega y correo

«Enviar entrevista» en revisión no se dispara solo. Los 2,8 s hacia el portal del cliente se mantienen.

Si la entrega falla, se permanece en revisión.

Si la entrega ok y el correo falla, la entrevista queda `completada` y se ofrece **Reintentar correo**, que solo reenvía la notificación cuando ya está completada (`soloCorreo`). No vuelve a ejecutar `submit_interview`.

## Kickoff con modelo

El texto de arranque pide saludo breve y la primera pregunta de inmediato. **Pendiente:** validar ese arranque con el modelo real. En esta etapa no hay llamadas al modelo ni envíos de correo reales.

## Límites de las pruebas

Unitarias con PGlite y funciones puras. E2E anónimas contra rutas. Staging autenticado no se ejecutó aquí. No hay correo Resend ni gateway de modelos en este candidato.
