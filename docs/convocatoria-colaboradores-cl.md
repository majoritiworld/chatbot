# Convocatoria de colaboradores — ComplianceLatam

Preparación del 1 de octubre de 2026. No activa el envío general. La excepción de prueba cubre una sola entrevista y un solo destinatario.

## Fase y carga

Proyecto ComplianceLatam (`compliance-latam`). Fase «Entrevistas a colaboradores», 15 minutos, acceso por enlace personal. Firmas socias sigue con ingreso por correo en la página del proyecto, sin este envío.

La planilla no se volvió a importar. Incidencias vigentes, sin contarlas como entrevistas:

- Chile fila 50, sin correo: María Jesús Bustamante.
- Chile fila 151, sin correo: Hugo Villalobos.
- Otros países fila 21, sin correo: Alma Perez Perez.
- Chile fila 67, consolidada en la misma persona. Cargo conservado: Compliance Officer Latam. Cargo descartado: Regional Compliance Officer.

Asignadas al revisar: 285, de las cuales 284 abiertas son destinatarios reales y una completada es la prueba anterior `prueba-colaborador-20260930@majoriti.world`. Cero correos vacíos entre las asignadas, cero correos repetidos, 285 enlaces y uno revocado: el de esa prueba anterior. Ningún envío de invitación registrado antes de la prueba autorizada.

Después se añadió una sola entrevista de prueba para `seba@majoriti.world`, sin iniciar. Los conteos preparados separan las pruebas de los 284. En el portal publicado eso se aplica cuando se despliegue este cambio.

## Invitación

Asunto de la fase: «Queremos conocer tu experiencia como colaborador de ComplianceLatam».

Cuerpo, en tú. La plantilla añade el saludo, el botón, la ayuda, la firma y el pie, así que el cuerpo no los repite:

Desde ComplianceLatam queremos conocer tu experiencia como colaborador, con el objetivo de seguir mejorando nuestra propuesta de valor y generar iniciativas que sean cada vez más relevantes para ti.

Por eso, te invitamos a participar en una breve entrevista individual a través de la plataforma Majoriti, donde podrás compartirnos tu experiencia, opiniones y sugerencias.

La entrevista toma aproximadamente 15 minutos. Puedes guardar tu avance y continuar más adelante desde el mismo enlace.

Muchas gracias desde ya por tu tiempo y colaboración. ¡Para nosotros es muy valioso contar con tu opinión!

Botón: «Comenzar mi entrevista». Después, la ayuda en tú («¿Tienes alguna pregunta? Responde a este correo o escribe a crivera@compliancelatam.legal.»), la firma «Saludos, Equipo ComplianceLatam» y el pie «Enviado a través de Majoriti». El texto plano conserva el enlace. No se muestra la URL larga ni una explicación de acceso. El acceso por correo y código sigue disponible para otras fases y no se explica en esta invitación. Remitente visible: Equipo ComplianceLatam vía Majoriti, desde `portal@mail.majoriti.world`. Reply-To: crivera@compliancelatam.legal.

Agradecimiento de la fase, en usted, sin enviarlo a la lista: asunto «Recibimos sus respuestas». Cuerpo: «Gracias por completar la entrevista. Sus respuestas llegaron correctamente a ComplianceLatam y se considerarán en el trabajo del proyecto.»

La prueba autorizada usa esa misma invitación con el prefijo «[PRUEBA]» en el asunto. Sin copia ni copia oculta. El agradecimiento de esa sola entrevista queda preparado igual, también sin copia, y solo sale cuando el cambio esté en el servidor que completa la entrevista.

La primera prueba, `1190524f-79e3-49e8-b090-7000711d21ad`, quedó con consentimiento y un turno. No se resetea. La prueba que se puede completar ahora es `c76190ba-49d7-4bae-bc80-91bc6c628bed`, sin iniciar, con la misma identidad y una plantilla que copia el guion real. Su clave de idempotencia es `entrevista-c76190ba-49d7-4bae-bc80-91bc6c628bed-invitacion`, distinta de la muestra anterior. Reejecutar ese envío no genera otro correo ni otra clave.

## Envío por lotes

El botón de la fase sigue rechazado en servidor: la convocatoria general no está habilitada. Cuando se autorice, el lote recorre las entrevistas de una en una, omite quien ya tiene un envío en estado enviado, omite las pruebas y guarda cada resultado. Un lote interrumpido se retoma por esos registros: los errores vuelven a entrar y los enviados no.

La clave de Resend de esta cuenta solo puede enviar, así que no se puede leer su cupo. La documentación pública de Resend parte de 2 solicitudes por segundo. El lote espera 1 segundo entre mensajes (`INVITACION_RITMO_MS`, entre 200 y 60000). Ante un límite, una cuota o una respuesta incierta reintenta hasta 5 veces (`INVITACION_INTENTOS_MAX`, entre 1 y 8). Si llega `Retry-After`, espera al menos ese plazo, con un máximo de 15 minutos. Si no llega, la espera crece desde el ritmo base y se detiene en 60 segundos.

Cada reintento usa la misma clave `entrevista-{id}-invitacion` y el mismo contenido armado para ese envío. No se genera otra clave. Si Resend indica que esa clave ya se usó con otro contenido, el envío queda en error y no se sustituye la clave. Dos ejecuciones a la vez comparten esa clave; el índice único de un envío en estado enviado impide un segundo registro. El registro guarda el id de Resend cuando el proveedor lo devuelve. Las pruebas y las asignaciones sin correo quedan fuera. No hay recordatorios programados.

## Pendiente antes de convocar

- Decidir si las respuestas siguen identificadas y, solo entonces, aplicar el aviso propuesto en [Identidad de las entrevistas a colaboradores](identidad-entrevistas-colaboradores.md).
- Confirmar el envío general. Hasta entonces `envioInvitacionesColaboradoresPermitido` sigue en falso y el lote no sale. El ritmo y los reintentos ya están en el lote; no activan la convocatoria.
- Corregir, si se quieren incluir, las tres filas sin correo. No inventar direcciones.
