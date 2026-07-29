# Despliegue en Vercel — guía de revisión

Última verificación: **28 de julio de 2026**
URL de producción: **https://task-keep-lime.vercel.app**
Repositorio conectado: `https://github.com/rronrri/TaskKeep` (rama `main`)

---

## 1. Deploy automático

El proyecto se importó en Vercel desde GitHub (Add New → Project → Import Git
Repository). Con esa integración el despliegue automático **ya está activo por
defecto**, no hay nada extra que configurar:

| Evento en Git | Resultado en Vercel |
|---|---|
| push a `main` | deploy a **producción** (`task-keep-lime.vercel.app`) |
| push a otra rama | deploy de **preview** con URL propia |
| abrir un Pull Request | deploy de **preview** + comentario en el PR |

**Cómo confirmarlo:** hacé cualquier push a `main` y mirá Vercel → proyecto →
pestaña **Deployments**. Debe aparecer un deploy nuevo en segundos, con el hash
del commit. Si no aparece, revisar Vercel → Settings → **Git** (repositorio
conectado, rama de producción, "Ignored Build Step" vacío).

> No existe carpeta `.vercel/` en el repo ni el CLI instalado localmente. Eso es
> normal y **no** afecta al auto-deploy: la integración vive del lado de Vercel,
> no del repositorio. Si en algún momento querés operar desde la terminal:
> `npm i -g vercel && vercel link`.

## 2. `vercel.json`

Solo declara el cron de recordatorios:

```json
{ "crons": [ { "path": "/api/cron/send-reminders", "schedule": "0 12 * * *" } ] }
```

- Se ejecuta **todos los días a las 12:00 UTC** (09:00 en Argentina).
- El plan Hobby de Vercel **solo admite crons diarios**; este schedule cumple.
- Vercel envía automáticamente el header `Authorization: Bearer $CRON_SECRET`.
  La ruta lo valida en `src/app/api/cron/send-reminders/route.ts:9`.
  **Si `CRON_SECRET` no está seteada en Vercel, el cron responde 401 y no se
  programa ningún recordatorio.**
- El cron no envía correos: programa envíos futuros en Resend (`scheduledAt`)
  dentro de una ventana de 29 días. Ver `src/lib/tasks/schedule-reminders.ts`.

## 3. Variables de entorno

### Las que el código realmente lee

Obtenidas con `grep -rhoE "process\.env\.[A-Z0-9_]+" src scripts next.config.ts`.

| Variable | Uso | ¿Obligatoria? | Valor esperado en producción |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente Supabase (`src/lib/supabase/server.ts`) | **Sí** — lanza excepción si falta | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | cliente admin de Supabase | **Sí** — lanza excepción si falta | service_role key (solo servidor) |
| `JWT_SECRET` | firma de sesión, state de OAuth y cifrado del refresh token de Google | **Sí** — mínimo 32 caracteres | aleatorio, ≥32 chars |
| `APP_URL` | links de emails, callback de OAuth, validación de Origin | **Sí** | `https://task-keep-lime.vercel.app` |
| `COOKIE_SECURE` | flag Secure de la cookie de sesión | recomendada | `true` |
| `COOKIE_NAME` | nombre de la cookie | no | `taskkeep_session` |
| `CRON_SECRET` | autentica el cron de recordatorios | **Sí** | aleatorio largo |
| `RESEND_API_KEY` | envío y programación de correos | **Sí** | API key de Resend |
| `RESEND_FROM_EMAIL` | remitente | **Sí** | remitente de dominio verificado |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth de Drive | si se usa Drive | — |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth de Drive | si se usa Drive | — |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Picker (expuesta al navegador) | si se usa Drive | — |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | Google Picker (expuesta al navegador) | si se usa Drive | — |
| `POSTGRES_URL_NON_POOLING` | solo `/api/admin/system-status` | opcional | — |
| `TEST_*` | solo `scripts/smoke-test.mjs` | no en producción | — |

### Las que están en `.env.example` pero el código NO usa

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_DATABASE`,
`POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`,
`POSTGRES_USER`, `RATE_LIMIT_SECRET`.

No molestan (varias las inyecta sola la integración Supabase↔Vercel), pero
conviene saber que **ninguna se lee desde el código**. No hay que perder tiempo
diagnosticando problemas achacándolos a estas variables.

## 4. Checklist de verificación del deploy

Comandos rápidos, sin necesidad de abrir el dashboard:

```bash
BASE=https://task-keep-lime.vercel.app

curl -s -o /dev/null -w "login: %{http_code}\n"  $BASE/login                     # 200
curl -s -o /dev/null -w "root: %{http_code}\n"   $BASE/                          # 307 -> /login
curl -s $BASE/api/health                                                          # {"status":"ok",...}
curl -s $BASE/api/cron/send-reminders                                             # 401 "No autorizado"
curl -s $BASE/api/admin/system-status                                             # 401 "No autenticado"
curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
     -d '{"email":"noexiste@test.invalid","password":"xxxxxxxx"}'                 # 401 "Credenciales inválidas"
```

**Cómo interpretarlo.** El último es el que más información da: si devuelve
`Credenciales inválidas` significa que la app llegó a consultar Supabase de
verdad, o sea que `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y
`JWT_SECRET` están cargadas y son válidas. Si en cambio devuelve **500**, casi
seguro falta una variable (`createAdminClient()` lanza
`Falta la variable de entorno ...`) o `JWT_SECRET` tiene menos de 32 caracteres.

Resultado de la corrida del 28/07/2026: **todos los checks en verde.**

Ya con sesión de admin iniciada, `/admin/settings` muestra el estado de
integraciones leyendo `/api/admin/system-status` (base de datos, email, Drive,
cron, `publicUrl`, `cookieSecure`).

## 5. Puntos que se rompen solo en producción

Cosas que funcionan en local y fallan desplegadas si no se configuran:

1. **`APP_URL` apuntando a `localhost`.** Rompe los links de los emails
   (recuperar contraseña, alta de usuario, recordatorios), el `redirect_uri` de
   Google OAuth y la validación de Origin de `protectMutation`.
2. **Redirect URI de Google.** En Google Cloud Console tiene que estar
   autorizado exactamente `https://task-keep-lime.vercel.app/api/google/callback`.
   Los deploys de *preview* tienen otra URL y **no** funcionarán con Drive salvo
   que se agreguen también.
3. **Dominio del remitente en Resend.** Sin dominio verificado, `RESEND_FROM_EMAIL`
   es rechazado y no sale ningún correo ni recordatorio.
4. **`CRON_SECRET` ausente.** El cron devuelve 401 en silencio; nadie se entera
   hasta que los recordatorios dejan de llegar. Revisar Vercel → Deployments →
   Crons periódicamente.
5. **Rate limiting en memoria.** `src/lib/security.ts` guarda los contadores en
   un `Map` del proceso. En Vercel cada invocación puede caer en una instancia
   distinta, así que **el límite de intentos de login es prácticamente
   inefectivo en producción**. Corrección pendiente; ver el documento de auditoría.

## 6. Migraciones de base de datos

Vercel **no** ejecuta migraciones. Hay 10 archivos en `supabase/migrations/` y
deben aplicarse a mano en el SQL Editor de Supabase, en orden alfabético, antes
de desplegar una versión que las necesite:

```
202606090001_initial_schema.sql
202606100002_delete_company_cascade.sql
202606120003_password_recovery.sql
202606120004_file_approvals.sql
202606150005_google_reminders_and_user_deletion.sql
202606150006_flexible_task_reminders.sql
202606150007_company_google_drive.sql
202606160001_custom_task_reminders.sql
202606160002_scheduled_reminders.sql
202606220001_task_folders.sql
```

> El `README.md` dice ejecutar solo `202606090001_initial_schema.sql` + `seed.sql`.
> Está desactualizado: faltan las otras nueve.

## 7. Rotación de secretos

`JWT_SECRET` no cifra solo las sesiones: también deriva la clave AES-256-GCM con
la que se guardan los refresh tokens de Google (`tokenKey()` en
`src/lib/google-drive/oauth.ts:87`). **Si se rota `JWT_SECRET`, todos los
refresh tokens de Google guardados quedan indescifrables** y cada gestor/a tiene
que reconectar su cuenta. Tenerlo presente antes de rotar.
