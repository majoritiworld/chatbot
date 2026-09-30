# Identidad de las entrevistas a colaboradores

La decisión de anonimato no está tomada. Esta nota describe el comportamiento que ya tiene la plataforma, para leerlo antes de convocar. No cambia la política.

## Portal del cliente

El cliente del proyecto ve el nombre de cada persona y puede abrir sus respuestas. Ese acceso es el de `puedeConsultar`: quien administra el proyecto consulta las entrevistas de su proyecto. Un participante no ve a las demás personas ni otro proyecto.

## Notion

Al completar, la transcripción se publica en el destino ya configurado. La página se titula con el nombre de la persona y la propiedad de firma o empresa lleva el nombre de su organización. El correo sirve para relacionar a la persona; no se guarda como campo de la transcripción. El cuerpo incluye el nombre de la fase «Entrevistas a colaboradores» para distinguirla de las fases anteriores.

Si Notion falla, la entrevista queda completada. Un reintento reutiliza `notion_transcripcion_id` y el mismo título, así que no abre otra página.

## Acceso

Cada colaborador entra con su enlace personal, sin correo ni código, o con correo y código a la misma entrevista. Escribir el correo en la página del proyecto no le abre la entrevista: esa entrada es solo para firmas socias. El enlace no cambia quién ve las respuestas: la entrevista es la misma que el cliente ve en su portal y la que llega a Notion.

## Textos que ve la persona

El aviso de bienvenida dice que las respuestas se guardan de forma exclusiva para la marca. No promete anonimato. La invitación, la entrevista y el cierre de esta fase tampoco lo prometen.
