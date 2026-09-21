# Invitaciones: revisión de Codex

Base: `65e0f0ceeaed07297ecdd97601ffc1ed5b8203a3` de Cursor.
Rama: `codex/invitacion-verificada`. Trabajo aislado; no modifica el worktree
de Cursor ni el árbol habitual. Sin publicación ni escrituras remotas.

## Correcciones

- La ficha de persona exige elegir explícitamente la entrevista a invitar.
  La lista consulta solo metadatos de esa persona y proyecto. La acción sigue
  exigiendo Majoriti y comprobando entrevista/persona/proyecto en servidor.
- Un callback vencido conserva `next` al volver al login para pedir un código.
- Las invitaciones con enlaces personales de acceso no llevan BCC al equipo.
  Los agradecimientos mantienen su política previa.
- Los errores de callback no imprimen mensajes del proveedor; el formulario
  de invitación devuelve un error genérico si falla el envío.

## Verificación local

- `pnpm check`: OK (279 archivos).
- `pnpm typecheck`: OK.
- Suite unitaria previa: 90 aprobadas. Prueba nueva de destinatarios: 1 aprobada.
  Esta última intercepta todas las llamadas de red en un proceso separado.
- `pnpm exec playwright test --config=playwright.invitation.config.ts`:
  6 aprobadas. Navegador y app reales, servidor HTTP local que sustituye Auth
  y PostgREST. **No demuestra integración real con Supabase ni sus RLS.**
  Cubre solicitud/reenvío/OTP, sesión abierta, callback válido y vencido,
  login sin destino, destino externo e ID inaccesible sin sustituirlo por otro.
- `next build --webpack`: OK, sin flags de demo ni migraciones.
  Se usó webpack porque las dependencias del worktree son un enlace al
  directorio de dependencias existente; no se cambió el comando de Vercel.
- Entorno: Node 24.13.1, pnpm disponible 10.30.3; se desactivó la descarga
  automática de pnpm 10.32.1 en estos comandos. No se modificó el lockfile.

Los primeros intentos de navegador detectaron límites del arnés: reloj de
reenvío, compilación fría y mezcla localhost/127.0.0.1. Corregidos en el test.
La corrida final pasó sin reintentos automáticos.

## Pendiente antes de invitar clientes

- Recorrido real de selección administrativa y correo a una cuenta exclusiva
  QA, abrir la invitación y confirmar la entrevista exacta (también cuenta
  existente con otras entrevistas). No se enviaron correos en esta revisión.
- Validar en el destino real que la consulta de metadatos del selector y el
  envío funcionan con su esquema y configuración de correo.
- Publicación y comprobación posterior siguen pendientes de autorización.

Las pruebas nuevas se ejecutan con servicios sintéticos separados; no añaden
endpoints ni omisiones de autenticación al producto.
