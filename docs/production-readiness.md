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
