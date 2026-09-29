# Ensayo local de marca por proyecto

Estado al 29 de septiembre de 2026: el ensayo local sigue en marcha contra Supabase local. La base de prueba sigue en los volúmenes de Docker. Los cambios del código no se han publicado ni se han llevado a producción. `.env.local` no se modificó ni se copió.

Queda una decisión abierta: si un cliente debe poder leer las respuestas individuales de otras personas de su proyecto. No se cambió ese permiso.

## Cómo volver a levantarlo

Hace falta Docker Desktop abierto. El binario `docker` no está en el PATH: está en `/Applications/Docker.app/Contents/Resources/bin`. El CLI de Supabase no está enlazado a ningún proyecto remoto. No ejecutes `supabase link`, `supabase db push` ni `supabase stop --no-backup`. Esa última opción borra los volúmenes y con ellos los datos de prueba.

Durante el ensayo se desactivó Resource Saver de Docker Desktop para que la máquina virtual no se pausara a los cinco minutos. Sigue desactivado.

```sh
export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:$PATH"
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
cd /Users/salbagli/Projects/consulting
supabase start
```

`supabase start` reutiliza el volumen. No hace falta volver a sembrar. En el volumen ya están `20260928062226` y `20260929134323`. Comprueba `http://127.0.0.1:54321/auth/v1/health` y Mailpit en `http://127.0.0.1:54324`. Antes de cualquier prueba, confirma que la app habla con `127.0.0.1:54321` y no con el proyecto remoto.

La app local usa `.env.white-label.local`, que está ignorado por git. No arranques con `.env.local`: ese archivo apunta a producción.

```sh
set -a
source .env.white-label.local
set +a
pnpm dev
```

El proceso debe quedar con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`. Los códigos de acceso salen en Mailpit y tienen 8 dígitos.

Para repetir el correo de confirmación, el simulador de Resend tiene que escuchar en `127.0.0.1:54329` antes de arrancar la app. `RESEND_BASE_URL` apunta ahí. Sin ese proceso, el envío de la entrevista se guarda y el correo queda pendiente. Notion, `AI_GATEWAY_API_KEY` y `OPENAI_API_KEY` siguen vacías en `.env.white-label.local`. El chat de la entrevista no usa la clave de OpenAI: esa clave es solo para la transcripción de voz. Si esta máquina tiene sesión de Vercel y el repo está enlazado, el SDK puede llamar al AI Gateway con ese inicio de sesión aunque las claves del archivo estén vacías.

Las contraseñas de las personas de prueba están comentadas en `.env.white-label.local`.

| Persona | Correo | Dónde entra |
| --- | --- | --- |
| Ana | ana.local@example.test | Cliente de Norte (`/norte-ficticia`) y stakeholder de Sur (`/sur-ficticia`) |
| Bea | bea.local@example.test | Stakeholder de Norte. Entrevista `cccccccc-cccc-4ccc-8ccc-ccccccccccc1`, enviada |
| Ciro | ciro.local@example.test | Stakeholder de Norte, entrevista asignada y sin contraseña |
| Admin | admin.local@example.test | `/login/admin` |

Norte es `11111111-1111-4111-8111-111111111111`. Sur es `22222222-2222-4222-8222-222222222222`. La entrevista abierta de Ana en Sur es `cccccccc-cccc-4ccc-8ccc-ccccccccccc2`.

Para parar otra vez, sin perder datos:

```sh
supabase stop
```

## Completado contra Supabase local

- Esquema anterior cargado, datos ficticios sembrados y después aplicada `supabase/migrations/20260928062226_proyecto_marca_acceso.sql`. Respuestas, entrevistas y permisos se conservaron. Recargar `proyecto_acceso` no duplicó filas ni pisó un rol ya guardado.
- Las políticas viejas que identificaban a la persona solo por el correo permitían leer y escribir aun sin fila en `proyecto_acceso`. Se quitaron. Con sesiones reales, Bea lee su entrevista y no la de Ana; sin membresía no hay lectura ni alta de respuesta; Ana no puede cambiar el flujo de la entrevista de Bea.
- En el navegador, con códigos reales de Mailpit: marca de cada proyecto, guardar, cerrar sesión, `/login` y el aviso de usar el enlace cuando el correo está en dos proyectos. Ana ve fases en Norte y no en la entrevista de Sur. Bea, con la sesión abierta, no entra en Sur. Cambiar el identificador de la entrevista ajena no deja responderla.
- Agregar a Ciro y asignarle entrevista no generó correo en Mailpit ni en el simulador de Resend.
- El correo de confirmación de Bea se probó contra el simulador local: una sola petición, marca Norte, y un segundo intento no volvió a enviarlo. Notion no se llamó.
- La app del commit `501e38e`, en otro directorio y en el puerto 3001, leyó esta misma base migrada. El admin mostró Norte, Bea entró a su entrevista enviada y el cambio de identificador a la entrevista de Ana fue rechazado. Ese servidor ya se apagó.

Las pruebas de `tests/unit/database.test.ts` y `tests/unit/marca-acceso.test.ts` pasaron: 27, incluida la que exige la sesión real en las tres funciones de la entrevista.

## Corregido en este ensayo

Al enviar, la entrevista pasaba a completada y la ficha de la persona se quedaba en curso. `append_interview_turns`, `complete_interview_section` y `submit_interview` corrían con los permisos de quien responde, y al quitar las políticas anchas esa escritura ya no llegaba. Ahora son `SECURITY DEFINER` y comprueban la entrevista antes de escribir. Esa primera comprobación todavía miraba el correo del JWT; el cierre de ese hueco está en la sección del 29 de septiembre. Una transacción revertida mostró que Bea no puede cambiar su ficha a mano y que el envío sí la deja en completada. La ficha real de Bea quedó en completada.

## Comprobado el 29 de septiembre

La app en marcha usaba `http://127.0.0.1:54321`. Las claves de IA, Notion y el correo real seguían vacías o apuntando al simulador. No se desplegó ni se enlazó el CLI a un proyecto remoto.

### Chat con IA

Con la sesión de Ana, en una entrevista desechable, el recorrido real fue: mensaje de la persona, respuesta del modelo, guardado de ambos y recuperación al salir al portal y volver a entrar. La base local quedó con tres turnos, en este orden: entrevistador, entrevistado, entrevistador. El botón Guardar llamó a `append_interview_turns` y respondió 204. El AI Gateway respondió 200 dos veces. No fue una respuesta simulada.

`.env.white-label.local` no tiene clave de modelo. La llamada salió por el inicio de sesión de Vercel que ya tenía esta máquina para el proyecto enlazado. No se copió ninguna clave de `.env.local`. Si el ensayo debe funcionar sin esa sesión, hace falta una `AI_GATEWAY_API_KEY` propia en `.env.white-label.local` y volver a arrancar la app con ese archivo exportado antes que `.env.local`.

La entrevista de prueba se borró. La ficha de Ana en Sur volvió a pendiente. La entrevista abierta de Ana y la enviada de Bea no se tocaron.

### Lectura de respuestas ajenas

No se cambió ningún permiso. El rechazo entre proyectos y la prohibición de responder una entrevista ajena siguen.

| Quién | En la aplicación | Directo en Supabase |
| --- | --- | --- |
| Stakeholder | Ve su entrevista y sus respuestas. La de otra persona dice que no le corresponde. | Lee solo su entrevista y sus respuestas. Otra entrevista, del mismo proyecto o de otro, no vuelve. |
| Cliente | En Norte ve el nombre y el estado de las entrevistas de las fases. Abrir la de otra persona no muestra la transcripción ni deja responder. Su entrevista de Sur sí se abre, porque ahí es participante. | `entrevista_cliente_select` y `respuesta_cliente_select` leen la transcripción y las respuestas de todo el proyecto guardado en `usuario.proyecto_id`. Ana, cliente de Norte, lee así la entrevista enviada de Bea y la de Ciro. Esa política no alcanza a Sur. |
| Majoriti | El admin ve la transcripción y el resumen en la ficha. | `entrevista_majoriti_all` y `respuesta_majoriti_all` cubren todas las filas. |

La decisión pendiente es si el cliente debe conservar esa lectura individual. Las políticas de arriba siguen como estaban.

### Funciones con permisos elevados

`append_interview_turns`, `complete_interview_section` y `submit_interview` aceptaban el correo del JWT aunque no coincidiera con `auth.uid()`. Un token de prueba, con el identificador de Bea y el correo de Ana, modificaba la entrevista de Ana. El login de la aplicación no arma ese token. Eso quedó corregido en `supabase/migrations/20260929134323_sesion_entrevista_definer.sql`, aplicada solo en la base local.

La identidad sale de `auth.uid()` y de `auth.users`. El correo del JWT y cualquier correo enviado por el navegador no se consultan. Hace falta una fila vigente en `proyecto_acceso` para el proyecto de esa ficha. `search_path` está vacío. Solo `authenticated` puede ejecutar las tres funciones. El helper `private.sesion_puede_operar_entrevista` no es ejecutable por `anon`, `authenticated` ni `service_role`. Cada escritura queda fijada a la entrevista bloqueada y a su ficha. Majoriti sigue pudiendo operarlas: el rol se lee de `usuario`, no de un dato del navegador.

Con sesiones reales contra `127.0.0.1`: Ana completó una entrevista propia de prueba y esa fila se borró; Bea no pudo escribir la de Ana; Ana no pudo escribir las de Bea ni Ciro; sin sesión la llamada devuelve 401; `service_role` devuelve 403; sin membresía, o con `proyecto_acceso` revocado, no hay lectura ni alta. La ficha de Bea sigue en completada.

`advance_interview_flow`, `mark_interview_thank_you_sent` y `private.own_stakeholder_id` quedaron en el mismo criterio, en `20260929141145_identidad_flujo_entrevista.sql`, también solo en local. Con la sesión real de Ana, una entrevista desechable pasó de bienvenida a presentación y a chat, y el acuse de correo se marcó. Bea, con su propia sesión, recibió «Interview not found». Un token armado en la prueba, con el identificador de Bea y el correo de Ana, también fue rechazado: esa combinación no sale del login. Majoriti pudo marcar el acuse y llegó a la comprobación de estado, no a la de identidad. La entrevista de prueba se borró. Las políticas del cliente siguen igual.

## Pendiente antes de publicar

1. La lectura del cliente quedó decidida: puede consultar la entrevista y las respuestas completas de su proyecto, sin modificarlas y sin entrar al admin. El aviso previo lo dice. La URL pública de la demo de ComplianceLatam sigue sin definirse.
2. `private.stakeholder_es_propio` y `mark_interview_notion_synced` siguen comparando el correo del JWT.

## Publicar, cuando toque

Primero la base, después la app. No se ha ejecutado `supabase db push` ni `supabase link`.

1. Revisar y aplicar, en el remoto, `20260928062226_proyecto_marca_acceso.sql`, después `20260929134323_sesion_entrevista_definer.sql` y después `20260929141145_identidad_flujo_entrevista.sql`.
2. Desplegar la app que llama a esas funciones.

Si la base se adelanta un momento, la app anterior sigue leyendo entrevistas y permisos; su pantalla de invitar sigue ahí y no hay que usarla. Volver el código y dejar la base migrada conserva respuestas y permisos. Restaurar las políticas o funciones viejas reabre el acceso sin membresía y, en las tres funciones de la entrevista, vuelve a fiarse del correo del JWT. Quitar la migración de marca borra la marca y `proyecto_acceso`, y restaura el correo único global de stakeholder.
