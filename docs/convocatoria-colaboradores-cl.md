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

Asunto de la fase: «Su experiencia con ComplianceLatam: entrevista de 15 minutos».

Cuerpo:

Desde ComplianceLatam queremos conocer su experiencia con la red y entender cómo podemos ser más útiles en su trabajo.

Le invitamos a una entrevista individual de aproximadamente 15 minutos en la plataforma Majoriti. Su perspectiva nos sirve incluso si hasta ahora ha participado poco o no ha utilizado la red.

Puede guardar su avance y continuar más adelante desde este mismo enlace.

Muchas gracias por su tiempo.

La plantilla añade el botón «Comenzar mi entrevista» y, después, la ayuda, la firma y el pie. El texto plano conserva el enlace de la entrevista. El acceso por correo y código sigue disponible y no se explica en esta invitación. Remitente visible: Equipo ComplianceLatam vía Majoriti, desde `portal@mail.majoriti.world`. Reply-To: crivera@compliancelatam.legal. Firma: Equipo ComplianceLatam.

Agradecimiento de la fase, en usted, sin enviarlo a la lista: asunto «Recibimos sus respuestas». Cuerpo: «Gracias por completar la entrevista. Sus respuestas llegaron correctamente a ComplianceLatam y se considerarán en el trabajo del proyecto.»

La prueba autorizada usa esa misma invitación con el prefijo «[PRUEBA]» en el asunto. Sin copia ni copia oculta. El agradecimiento de esa sola entrevista queda preparado igual, también sin copia, y solo sale cuando el cambio esté en el servidor que completa la entrevista.

## Envío por lotes

El botón de la fase sigue rechazado en servidor: la convocatoria general no está habilitada. Cuando se autorice, el lote recorre las entrevistas de una en una, omite quien ya tiene un envío registrado y omite las pruebas, y guarda cada resultado. Pendiente de ese envío masivo: controlar el ritmo y reintentar cuando Resend responda un límite. El reintento no debe repetir un mensaje que Resend ya aceptó: la clave de idempotencia dura 24 horas y el registro local en estado enviado también omite ese destinatario. Hoy no hay pausa entre mensajes ni un reintento específico de esos límites. No hay recordatorios programados.

## Pendiente antes de convocar

- Decidir si las respuestas siguen identificadas y, solo entonces, aplicar el aviso propuesto en [Identidad de las entrevistas a colaboradores](identidad-entrevistas-colaboradores.md).
- Controlar el ritmo del envío masivo y reintentar los límites de Resend sin duplicar mensajes ya aceptados.
- Confirmar el envío general. Hasta entonces `envioInvitacionesColaboradoresPermitido` sigue en falso y el lote no sale.
- Corregir, si se quieren incluir, las tres filas sin correo. No inventar direcciones.
