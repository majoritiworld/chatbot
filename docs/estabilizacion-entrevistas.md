# Estabilización de entrevistas

## Cambios

- Los participantes pueden leer su perfil, pero ya no modificarlo directamente. Los cambios de rol, proyecto e identidad quedan bajo la política administrativa existente o el cliente de servidor con `service_role`.
- La transcripción guarda el mensaje ensamblado del stream con el mismo identificador que recibe el navegador. El historial reenviado se deduplica por ese identificador, sin comparar textos: dos respuestas legítimas iguales siguen siendo dos turnos distintos.
- El servidor confirma el guardado de los turnos recibidos antes de llamar al modelo. Si falla, devuelve un error recuperable. El guardado de la respuesta del modelo también es estricto y sus fallos se comunican en el stream.
- La notificación de sección completada espera al guardado del último mensaje, para evitar desmontar el chat antes de persistirlo.
- El helper de cierre permite que un reintento de una sección ya completada llegue al RPC, que devuelve el estado actual sin volver a avanzar.
- Se sustituyeron las pruebas de chat público/registro con contraseña por las del acceso actual. Las comprobaciones de dominio se separaron de las de navegador.

## Verificación local y CI

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test:unit
pnpm exec playwright install chromium
pnpm test:e2e
```

No ejecutes `pnpm build` contra un entorno compartido para validar este cambio. El script corre `tsx lib/db/migrate` (Drizzle sobre `POSTGRES_URL`) antes de `next build`. Eso no aplica las migraciones de `supabase/migrations`, pero sí puede escribir en la base configurada en `.env.local`.

Las pruebas de lógica e integración usan PostgreSQL en memoria mediante PGlite. Ejecutan todas las migraciones del repositorio sin modificarlas; solo simulan los esquemas y funciones de infraestructura de Supabase. Prueban permisos de perfiles, propiedad de entrevistas, reenvío de turnos, repetición de cierres y envíos, y rechazo de transiciones inválidas. El stream se prueba con el SDK real y un modelo ficticio, incluyendo errores de persistencia.

Las pruebas de navegador usan un servidor separado en el puerto 3101 y `.next-test`, con credenciales ficticias. Comprueban login, registro deshabilitado y rechazo de acceso anónimo. No envían correos ni usan datos reales. No sustituyen una prueba autenticada contra un entorno Supabase de staging, ni una prueba de concurrencia con varias conexiones reales.

Los workflows no requieren secretos de producción. Las plantillas de correo se excluyen de Biome porque contienen sintaxis de Go Templates de Supabase; el código de la aplicación sigue bajo análisis estático.

## Auditoría SQL de solo lectura

Archivo: `supabase/audits/estabilizacion-entrevistas-readonly.sql`.

Ejecutarlo en el SQL Editor del proyecto destino **antes** de aplicar la migración y otra vez **después**. No consulta entrevistas ni perfiles. Resultados que hay que recoger:

| Consulta | Qué debe verse después de la migración |
| --- | --- |
| `schema_migrations` | Incluye `20260919090000` / `restrict_profile_updates`. Comparar también por **nombre**: varias migraciones locales tienen version distinta a la remota. |
| RLS de `public.usuario` | `rls_habilitado = true`. |
| Políticas de `usuario` | Solo `usuario_select_self_or_majoriti` (SELECT) y `usuario_all_majoriti` (ALL). `usuario_update_self_or_majoriti` debe figurar como `debe_eliminarse` hasta aplicarla, y desaparecer después. Cualquier otra política es `no_esta_en_el_repositorio`. |
| Políticas de escritura extra | Vacío, salvo `usuario_all_majoriti`. |
| Privilegios de tabla | `authenticated` conserva UPDATE/INSERT/DELETE (los usa Majoriti vía RLS). `service_role` conserva escritura. Un GRANT de escritura a `anon` no basta para cambiar filas si no hay política para `anon`. |
| Funciones | `private.current_user_rol`, `private.current_user_proyecto_id`, `private.is_majoriti`, `private.handle_new_user`. |
| Triggers/vistas sobre `usuario` | Vacío, salvo el trigger de Auth `on_auth_user_created` (vive en `auth.users`). |

### Destino `consulting-portal` — antes y después (2026-09-19)

Proyecto Supabase `consulting-portal`, ref `oaqjpyhbxagrelhwzyuq`, host `db.oaqjpyhbxagrelhwzyuq.supabase.co`, región `eu-central-1`, estado `ACTIVE_HEALTHY`. Confirmado de nuevo inmediatamente antes del DROP. No se usó `supabase db push`. No se reaplicaron otras migraciones. No se leyeron ni modificaron filas de `usuario`, entrevistas ni transcripciones.

**Antes (catálogo):** tres políticas en `public.usuario` (`usuario_all_majoriti` ALL, `usuario_select_self_or_majoriti` SELECT, `usuario_update_self_or_majoriti` UPDATE). `schema_migrations` no tenía `20260919090000`.

**Intervención:** `DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario`, más un INSERT en `supabase_migrations.schema_migrations` con **la misma version y nombre del archivo del repo**:

| Campo | Valor |
| --- | --- |
| `version` | `20260919090000` |
| `name` | `restrict_profile_updates` |
| `statements` | `DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario;` |

No se usó `apply_migration` del MCP: esa herramienta asigna un timestamp propio y habría dejado un version distinto al de `supabase/migrations/20260919090000_restrict_profile_updates.sql`. Con la version alineada, un push futuro **no** debería volver a aplicar este DROP. Sigue prohibido `supabase db push` del directorio completo: otras seis migraciones locales siguen con version distinta a la remota (`fase_descripcion_evento`, `fase_fecha_cierre`, `tarea_checklist`, `evento_minuta`, `stakeholder_apellido`, `dedupe_entrevista_plantilla`).

**Después (catálogo, reauditoría):**

- `schema_migrations` incluye `20260919090000` / `restrict_profile_updates`.
- RLS de `public.usuario` sigue activo (`force_rls` no).
- Políticas restantes: solo `usuario_select_self_or_majoriti` (SELECT, propio id o Majoriti) y `usuario_all_majoriti` (ALL, `private.is_majoriti()`).
- `usuario_update_self_or_majoriti` **ya no existe**. No hay otras políticas de UPDATE/INSERT/DELETE sobre `usuario` aparte de `usuario_all_majoriti`.

**No comprobado con cuentas autenticadas:** PATCH REST de un participante, operaciones de Majoriti en el admin, ni el flujo de entrevista. Eso sigue pendiente de cuentas de prueba. El código de chat de esta corrección **no** está en el deploy de Vercel.

Esta lectura no demuestra que Preview u otro proyecto de Vercel usen la misma base. Hay que identificar el destino en cada despliegue.

## Pruebas de staging (cuentas de prueba)

Hace falta un proyecto o datos de prueba. Preview de Vercel apunta a la misma base que producción: solo usa personas *@example.test.

Copia `.env.staging.example` a `.env.staging.local` (gitignored vía `.env*.local`). No pegues tokens en el chat ni en Git. `pnpm test:staging` carga ese archivo.

Cómo obtener sesiones normales (no `service_role`):

1. Invita en el admin a `participante@example.test`, `otro@example.test` y `majoriti@example.test`.
2. Entra en el portal con cada cuenta de prueba (código de correo, como un usuario real).
3. Playwright: `pnpm exec playwright codegen "$STAGING_BASE_URL/login" --save-storage=tests/staging/.auth/participant.json` y guarda la sesión después del login. Esa carpeta está en `.gitignore`.
4. El JWT de acceso sale de la sesión del navegador (almacenamiento de Supabase). Pégalo solo en `.env.staging.local`.
5. `STAGING_SUPABASE_ANON_KEY` es la clave pública; no uses la service role.

Las pruebas abortan si algún correo no termina en `@example.test` (o `STAGING_TEST_EMAIL_DOMAIN`). Un PATCH autorizado de `proyecto_id` restaura el valor original en `finally` y vuelve a leerlo para comprobarlo.

El SQL `supabase/audits/staging-entrevista-checks.sql` exige el mismo dominio, restaura `proyecto_id` como postgres y termina en `ROLLBACK`.

`pnpm test:staging` no corre en CI. Sin `.env.staging.local` las pruebas se omiten; eso no cuenta como aprobado.

## Destino Vercel verificado (CLI, 2026-09-19)

Carpeta local vinculada a `prj_tdrbYR688pIZ38ZKUVgcy7iiNHaw` / `consulting-portal`, org `team_wdpo1sNMSO3AxeZq4onbBBqn` (`majoritiworlds-projects`). CLI autenticada como `majoritiworld`. No es el proyecto `majoriti-consulting`.

- Producción READY: `dpl_ciiKK6ZP2DH1KqQ34r2UQYnh5qkw` (18 sep 2026 14:48). Coincide en el minuto con `1eaa7f9147959648215419fdf04107d3b2509024` (`origin/main`: «Fix production typecheck for the interview tour and close helpers.»).
- Alias de producción: `https://portal.majoriti.world`, `https://consulting-portal-xi.vercel.app`, `https://consulting-portal-majoritiworlds-projects.vercel.app`, `https://consulting-portal-git-main-majoritiworlds-projects.vercel.app`.
- `NEXT_PUBLIC_SUPABASE_URL` de Production y Preview = `https://oaqjpyhbxagrelhwzyuq.supabase.co`. Preview usa la **misma** base que producción.
- Production lista `POSTGRES_URL` (y otras `POSTGRES_*`) como variables cifradas recientes. El `env pull` no exportó el valor. Tratarlas como presentes: el `build` anterior (`tsx lib/db/migrate && next build`) las usaría.

## Build sin migraciones accidentales

`package.json` `build` y `vercel.json` `buildCommand` quedan en `next build`. Drizzle (`lib/db/migrations`, tablas `User`/`Chat` del template) no corre en Vercel. `lib/db/migrate.ts` también sale si `VERCEL=1`. `pnpm db:migrate` sigue siendo explícito y **no** debe usarse contra producción. `supabase db push` del directorio completo sigue prohibido.

## Procedimiento de despliegue

La corrección de permisos **no** viaja con el deploy de Vercel. `next build` tampoco aplica `supabase/migrations`.

### 1. Identificar el destino

1. Supabase: `consulting-portal` (`oaqjpyhbxagrelhwzyuq`). Ya coincide con `NEXT_PUBLIC_SUPABASE_URL` de Production y Preview.
2. Vercel: equipo `majoritiworlds-projects`, proyecto `consulting-portal`. Dominio canónico de producción: `https://portal.majoriti.world`.
3. No publiques `majoriti-consulting`.

### 2. Verificar el estado actual

Ejecuta `supabase/audits/estabilizacion-entrevistas-readonly.sql` en ese proyecto. Si `usuario_update_self_or_majoriti` ya no existe y `20260919090000` está aplicada, no vuelvas a correr el SQL de la migración.

Compara `schema_migrations` **por nombre** con `supabase/migrations/*.sql`. Si las versions locales no coinciden, **no** uses `supabase db push` ni un apply del directorio completo.

### 3. Aplicar solo la restricción de perfiles

En `consulting-portal` (`oaqjpyhbxagrelhwzyuq`) esto **ya está hecho** (2026-09-19): el DROP y la fila `20260919090000` / `restrict_profile_updates`. No lo repitas ahí. En cualquier otro proyecto, usa solo el SQL siguiente (no `db push` del directorio):

```sql
DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario;
```

Registra el historial si la herramienta no lo hace:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260919090000',
  'restrict_profile_updates',
  ARRAY['DROP POLICY IF EXISTS usuario_update_self_or_majoriti ON public.usuario;']
);
```

No reaplicas las migraciones de plantillas, fases o entrevistas. Esta migración es independiente del chat y puede ir **antes** del deploy de la app.

### 4. Verificar permisos

Vuelve a correr la auditoría de solo lectura. Criterio para seguir:

- No existe `usuario_update_self_or_majoriti`.
- Siguen `usuario_select_self_or_majoriti` y `usuario_all_majoriti`.
- No ha aparecido otra política de escritura sobre `usuario`.

Con una cuenta de **prueba**, confirma que el PATCH a `/rest/v1/usuario` del propio id no cambia `rol` ni `proyecto_id`, y que Majoriti sigue pudiendo administrar (invitar, asignar proyecto) vía admin / `service_role`.

### 5. Desplegar la aplicación

Todavía no hay commit con estos cambios: están en el working tree de `main`. Tras autorizar: commit, push a `main` (GitHub `majoritiworld/chatbot`; Vercel despliega ese repo). Confirma en el dashboard que el build command efectivo es `next build`. Espera READY en `portal.majoriti.world`. No ejecutes `pnpm db:migrate` ni `supabase db push`.

### 6. Comprobaciones posteriores

Con cuentas de prueba, en la URL del deploy:

1. Responder, recargar, Guardar.
2. Cerrar sección y repetir el cierre (corte de red / doble clic).
3. No usar Enviar final si dispara correo real; el reintento de `submit_interview` ya está cubierto en pruebas unitarias. Si se prueba el envío, usa un buzón de prueba.
4. Otra cuenta no entra a la entrevista ajena.

### Detener el despliegue

Para **antes** de aplicar SQL o de promover el deploy si:

- El Reference ID de Supabase no coincide con `NEXT_PUBLIC_SUPABASE_URL` de ese entorno.
- `supabase db push` o el CLI pretenden aplicar files cuyo `version` no está en remoto (sobre todo `dedupe_entrevista_plantilla`).
- Tras el DROP, desaparece `usuario_all_majoriti` o el SELECT propio.
- Majoriti no puede invitar ni actualizar perfiles de prueba.
- El deploy de Vercel no es el proyecto `consulting-portal`.

No completes el paso 5 si el paso 4 falla.

### Recuperación

- Para revertir **solo la app**, usa Instant Rollback / Promote del deployment ya construido (`dpl_ciiKK6ZP2DH1KqQ34r2UQYnh5qkw`, commit `1eaa7f9`). Eso reasigna alias al artefacto existente. **No** vuelvas a desplegar ese commit (`vercel --prod` / push del SHA antiguo): su `package.json` todavía corre Drizzle en el build y Production tiene `POSTGRES_URL`.
- La política `usuario_update_self_or_majoriti` permanece retirada en Supabase aunque la app vuelva atrás. **No** la recrees.
- Si faltara `usuario_all_majoriti`, restáurala desde `supabase/migrations/20260914082758_private_rls_helpers.sql` (política Majoriti `FOR ALL`), nunca la política de auto-actualización.
- `private.handle_new_user` y el cliente `service_role` no dependen de la política eliminada.
- Esta implementación no elimina transcripciones históricas duplicadas. No se debe deduplicar por texto automáticamente.
