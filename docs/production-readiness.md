# Verificación de producción — 14 de septiembre de 2026

Estado: paso 2 cerrado (esquema, historial, políticas y Auth de panel). HaveIBeenPwned no se pudo activar: exige plan Pro.

## Comprobado

- GitHub: `majoritiworld/chatbot`, rama `main`, commit `8e5b0e1e45ce91972ba84da4d35e2447915d0ad7`.
- Vercel: `majoritiworlds-projects/consulting-portal`, dominio `https://consulting-portal-xi.vercel.app`.
- Despliegue `dpl_H97QdkroDZWnTMuMUrEnFj3hKnao`: READY y mismo commit.
- La carpeta está vinculada al proyecto correcto de Vercel.
- URL y clave pública de Supabase coinciden entre configuración local y producción.
- Consultas HEAD autenticadas con la clave administrativa local: existen las diez tablas del dominio y todas las columnas contrastadas con las migraciones, incluyendo `consentimiento_en` y `plantilla_id`.
- Bucket `documentos` existente y privado.
- Supabase Auth: email habilitado, confirmación automática deshabilitada. El registro público no está deshabilitado; su interacción con las políticas requiere revisión.
- AI Gateway: autenticación OIDC válida y saldo positivo, comprobado sin generar contenido. No necesita copiar la clave local del Gateway.
- Clave local de OpenAI: consulta de `whisper-1` exitosa. Esto no prueba una transcripción real ni cuotas de inferencia.

## Diferencias de configuración

- Corregido con autorización explícita: `NEXT_PUBLIC_SITE_URL` de Production pasó de `http://localhost:3000` a `https://consulting-portal-xi.vercel.app`.
- Configurado con autorización explícita: `AUTH_SECRET` de Production, como secreto sensible, con el valor local existente. El código lo necesita para guardar y restaurar la sesión del administrador al entrar como participante.
- Configurado con autorización explícita: `OPENAI_API_KEY` de Production, como secreto sensible, con la clave local validada. La ruta de transcripción la requiere.
- `SUPABASE_SERVICE_ROLE_KEY` existe como variable sensible no exportable. No se verificó su valor ni funcionamiento en el despliegue; un valor vacío al exportarla no demuestra que falte.
- Preview no tiene `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No se ha habilitado ni validado un entorno de pruebas independiente.
- La revisión automática pidió autorización explícita para transferir secretos; el usuario la concedió y los cambios se aplicaron. El redespliegue `dpl_6kikqbF7cPWuTxPaUTUi5h7XPJoo` terminó READY y tiene asignado el dominio `xi`, con el mismo commit.

## Migraciones: historial local alineado con producción

El SQL original se recuperó de `supabase_migrations.schema_migrations.statements`. Los archivos locales usan ahora las mismas versions remotas. No se reaplicaron las nueve migraciones ya existentes.

| Remoto | Nombre |
| --- | --- |
| `20260910075601` | consultoria_schema_rls |
| `20260910080328` | revoke_definer_execute |
| `20260910091444` | portal_cliente_fase_entrevista |
| `20260910113434` | admin_majoriti_transcripcion_documentos |
| `20260910113446` | admin_majoriti_storage_documentos |
| `20260910155450` | firma_socia_proyecto_shared_read |
| `20260912182759` | entrevista_plantilla |
| `20260912183306` | stakeholder_own_interview_access |
| `20260914061638` | entrevista_onboarding_consentimiento |
| `20260914082758` | private_rls_helpers (nueva; aplicada en producción) |

`private_rls_helpers` mueve las funciones `SECURITY DEFINER` a `private`, restringe políticas a `authenticated`, envuelve `auth.uid()` y añade índices en las FK que faltaban. El linter de seguridad ya no marca esas funciones; queda HaveIBeenPwned desactivado (ajuste de Auth, no de SQL).

## Auth de panel (aplicado con Management API)

- Site URL = `https://consulting-portal-xi.vercel.app`
- Redirects: `/auth/callback` en localhost, dominio `xi` y el preview `swart` que ya estaba.
- Registro público deshabilitado. OTP de 8 dígitos, 1 hora.
- Plantillas alineadas con `supabase/email-templates` (código, no `ConfirmationURL`; invite con `TokenHash`).
- SMTP ya estaba: Resend `smtp.resend.com`, remitente `Majoriti` / `portal@mail.majoriti.world`. No se tocó la contraseña.
- HaveIBeenPwned no se activó: la API responde que es de plan Pro.

El paso 3 comprobará entrega de correo, inicio de sesión, generación IA y transcripción mediante cuentas y contenido de prueba.

## Correos de entrevista enviados por la app (30 de septiembre de 2026)

- La confirmación sale como «{Cliente} vía Majoriti» desde `INTERVIEW_EMAIL_FROM`, con respuesta al `contacto_email` del proyecto. El destinatario, la marca y los textos se leen en servidor desde la entrevista.
- Si falta el cliente (nombre público o `cliente`), falta el contacto, el destinatario no coincide o la fase es de otro proyecto, el correo no sale y queda una incidencia en `entrevista_correo_incidencia`, visible en el admin del proyecto. La entrevista se guarda igual.
- Copia oculta: solo la confirmación va con copia a `INTERVIEW_EMAIL_BCC` (por defecto `hello@majoriti.world`), salvo que el destinatario sea esa misma bandeja. Las invitaciones nunca llevan copia porque contienen el acceso personal.
- Invitaciones: bloqueadas en servidor mientras `HABILITAR_INVITACIONES_CORREO` no sea `1`. La comprobación está en la entrada de `enviarCorreoInvitacion` y otra vez justo antes de Resend.
- Vista previa sin envío: `/admin/correos`, con ejemplos ficticios o un proyecto real con un participante ficticio.
- Una fase con `acceso_solo_correo` no envía invitaciones: el servidor rechaza el envío de esa fase aunque las invitaciones estén habilitadas.

## Acceso a entrevistas (30 de septiembre de 2026)

Tres entradas, todas sobre los mismos registros de persona y entrevista. Abrir una entrada no crea cuentas ni entrevistas y no envía correos.

- Enlace personal (`/e/{token}`), para fases con `acceso_enlace_personal`. Abre la entrevista sin correo ni código. El token no se consume: si un escáner de correo abre el enlace, la persona puede usarlo igual. Revocar el enlace o apagar el ajuste de la fase cierra también las sesiones abiertas.
- Solo correo (`/{slug}`), para fases con `acceso_solo_correo`. Hoy solo «Entrevistas a Firmas Socias» de ComplianceLatam, y solo esa fase se marca en la migración: no hay ajuste en el admin. Conocer el correo asignado basta para abrir la entrevista; es una decisión aceptada por el cliente. Un correo sin asignación en esa fase, incluido el de un colaborador, recibe el mismo aviso genérico. Con varias asignaciones no se elige ninguna.
- Correo y código (`/{slug}?codigo=1` o `/login`), para todos, con los permisos de siempre.

Las dos primeras dejan una cookie firmada (`mj_entrevista`) que abre una sola entrevista y no lleva rol. Se revalida en la base de datos en cada petición: lectura, chat, guardado, cierre, envío, transcripción de voz y Notion. Si el navegador ya tiene la sesión de otra persona, del portal o de otra entrevista, la entrada se rechaza y ofrece cerrar sesión. La misma persona sí puede pasar de una entrevista suya a otra.

Probado en Supabase local con participantes ficticios (`scripts/sembrar-acceso-local.ts`), sin tocar entrevistas reales.

## Pendiente para desplegar

1. Aplicar en remoto, en este orden, `20260930160000_correos_invitacion_incidencia.sql` y `20260930170000_acceso_simplificado_entrevista.sql`. El código nuevo depende de la segunda: sin ella, las fases no tienen los ajustes de acceso y los enlaces personales dejan de abrir.
2. Desplegar el código después de las migraciones.
3. Poner `contacto_email` en el proyecto ComplianceLatam. Hoy está vacío, y así las invitaciones y confirmaciones quedan bloqueadas por falta de contacto.
4. Habilitar `HABILITAR_INVITACIONES_CORREO` y `envioInvitacionesColaboradoresPermitido()` solo con autorización, y probar antes en clientes de correo reales.
