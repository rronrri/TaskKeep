# Estado del proyecto — TaskKeep Empresarial

Actualizado: **28 de julio de 2026** · commit `d27c060`

Este documento responde a dos preguntas: **en qué estado quedó** y **qué falta**.
Para el despliegue, ver `docs/DEPLOY.md`.

> El detalle de los hallazgos de la auditoría de seguridad se mantiene **fuera de
> este repositorio** mientras haya correcciones pendientes, porque el repo es
> público y la aplicación está desplegada. Se incorporará aquí una vez aplicadas
> las correcciones.

---

## Resumen en una línea

Aplicación funcionalmente completa y desplegada en producción, con correcciones
de seguridad pendientes de aplicar antes de usarla con datos reales de clientes.

## Qué es

Gestor de tareas multiempresa con tres roles, archivos adjuntos sincronizados con
Google Drive y recordatorios por correo. Monolito Next.js sobre Supabase.

| | |
|---|---|
| Stack | Next.js 16.2.9 (App Router) · React 19.2.4 · TypeScript · Tailwind 4 |
| Base de datos | Supabase (PostgreSQL) — acceso solo vía `service_role` desde el servidor |
| Autenticación | Propia: bcrypt + JWT (`jose`) en cookie httpOnly, 8 h |
| Correo | Resend (`@react-email` para las plantillas) |
| Archivos | Google Drive API v3 + Google Picker, OAuth por empresa |
| Despliegue | Vercel (auto-deploy desde `main`) · también hay Dockerfile y compose |
| Tamaño | ~7.050 líneas, 108 archivos `.ts`/`.tsx`, 36 route handlers, 10 migraciones |
| Historial | 25 commits, del 9 de junio al 28 de julio de 2026 |

## Arquitectura

```
src/
  app/
    api/            36 route handlers — toda la lógica de negocio
    admin/ manager/ collaborator/    páginas por rol, protegidas en el servidor
    login/ forgot-password/ reset-password/
  components/       UI por dominio (task, admin, calendar, company, user, ui...)
  lib/
    auth/session.ts        emitir/leer/destruir la cookie JWT
    api.ts                 requireApiUser() — guarda de rol y de contraseña temporal
    security.ts            rate limiting + chequeo de Origin  (pendiente de revisión)
    supabase/server.ts     createAdminClient()
    google-drive/          oauth.ts (tokens, cifrado) + index.ts (operaciones)
    tasks/                 reminders.ts (cálculo) + schedule-reminders.ts (Resend)
    validators/            esquemas Zod de entrada
    audit.ts               writeAudit()
  server/policies/         helpers de permisos
  emails/                  plantillas React Email
supabase/migrations/       10 archivos, se aplican a mano
```

**Decisiones de diseño que conviene conocer antes de tocar el código:**

- **No se usa Supabase Auth ni RLS.** Todo pasa por el `service_role`, así que la
  seguridad depende enteramente de los filtros `.eq("company_id", ...)` escritos a
  mano en cada endpoint. Si añadís una consulta nueva y olvidás ese filtro, se
  filtran datos entre empresas. Es el punto más frágil del diseño.
- **No hay `middleware.ts`.** La protección de páginas la hace `AppShell`
  (componente de servidor) y la de la API `requireApiUser()`. No hay ningún punto
  central por donde pasen todas las peticiones.
- **El JWT lleva el rol y la empresa incrustados** y no se revalida contra la base
  en cada petición.
- **Los recordatorios no se envían desde la app.** El cron diario los *programa*
  en Resend con `scheduledAt`; Resend los entrega a la hora exacta. Por eso el
  planner es aditivo e idempotente y usa una ventana de 29 días (Resend admite 30).

## Funcionalidad terminada

Todo lo siguiente está implementado y funcionando en producción:

**Roles y cuentas**
- Tres roles: administrador/a, gestor/a, colaborador/a, con permisos diferenciados.
- Empresas con límites configurables de gestores/as y colaboradores/as (RPC `can_add_company_user`).
- Alta de usuarios con contraseña temporal enviada por correo y cambio obligatorio en el primer acceso (bloquea toda la API hasta que se cambia).
- Recuperación de contraseña por correo con token de un solo uso, 30 min de validez.
- Eliminación en cascada de empresas y usuarios (RPC `delete_company_cascade`, `delete_user_cascade`).
- Auditoría de acciones con pantalla de consulta para el administrador/a.

**Tareas**
- CRUD con prioridad (baja/media/alta/crítica, con color), estado, fecha límite, fijado y borrado lógico.
- Vista de tarjetas y de lista, filtros (estado, prioridad, responsable, carpeta, rango de fechas), búsqueda y ordenamiento.
- Vista de calendario (FullCalendar).
- Carpetas y subcarpetas anidadas estilo Google Drive, con arrastrar y soltar y deshacer tras eliminar.
- Comentarios, historial de cambios de estado y flujo de solicitud/aprobación de cambio de estado colaborador/a → gestor/a.
- Los gestores/as asignan tareas a su equipo; los colaboradores/as solo pueden crear tareas para sí mismos/as.

**Google Drive**
- OAuth por empresa: el gestor/a conecta su cuenta y define una carpeta raíz; los colaboradores/as la heredan.
- Cada tarea genera automáticamente su carpeta `AAAA-MM-DD - título`. Si se borra el último adjunto desde la tarea, la carpeta vacía se borra también; borrar la tarea nunca toca Drive.
- Subida de archivos con validación de tipo (PDF, PNG, JPEG, TXT, DOCX) y tamaño (10 MB).
- Los archivos de colaboradores/as van a `Pendientes` y requieren aprobación; al aprobarse se mueven a la carpeta de la tarea o a una subcarpeta elegida.
- Explorador de carpetas y creación de subcarpetas desde la interfaz, con Google Picker.

**Recordatorios**
- Modos: ninguno, diario, mensual y "antes de la fecha límite" con avisos configurables (por defecto 5, 3 y 1 día).
- Manejo explícito de zona horaria del usuario en los recordatorios recurrentes.
- Copia al gestor/a cuando la tarea es de un/a colaborador/a.
- Cancelación y reprogramación automática al editar o eliminar la tarea.
- Registro de envíos consultable en `/admin/notifications`.

**Infraestructura**
- Desplegado en Vercel con auto-deploy desde `main` y cron diario configurado.
- Dockerfile con salida standalone, usuario sin privilegios y healthcheck; compose para desarrollo y para producción.
- `/api/health` para probes.

## Qué falta

### Bloqueante para producción con clientes reales

La auditoría del 28/07/2026 identificó correcciones pendientes en cuatro áreas.
Hasta aplicarlas, **no** se debería cargar información real de clientes:

1. **Permisos de la integración con Google Drive** — alcance de los tokens y validación de las carpetas de destino.
2. **Permisos sobre carpetas de tareas** — reglas de propiedad al eliminar y al restaurar.
3. **Rate limiting** — la implementación actual es en memoria y no es efectiva en un entorno serverless con varias instancias.
4. **Validación de parámetros de consulta** en el listado de tareas.

Como medida provisional hasta la primera corrección: que el gestor/a conecte a
TaskKeep una **cuenta de Google dedicada**, no su cuenta personal.

El detalle técnico está en el documento de auditoría, fuera del repositorio.

### Deuda técnica importante

- **Cero tests automatizados.** Lo único que hay es `scripts/smoke-test.mjs`: 34 líneas que hacen login y comprueban que ~8 endpoints devuelvan 200. No verifica el aislamiento entre empresas, ni los permisos por rol, ni la lógica de recordatorios. Dado que la seguridad depende de filtros `.eq("company_id")` escritos a mano en cada endpoint, unos tests de aislamiento son la inversión con mejor relación coste/beneficio del proyecto.
- **Sin CI.** No hay GitHub Actions; nada corre `lint` ni `build` antes de un merge. Vercel construye después del push, así que un error de compilación se descubre cuando ya está en `main`.
- **Sin observabilidad.** Los errores van a `console.error` y quedan en los logs de Vercel, que se retienen poco tiempo. No hay Sentry ni alertas: si el cron falla o Resend rechaza los correos, nadie se entera.
- **Migraciones manuales.** No hay Supabase CLI ni control de qué migración se aplicó a qué entorno. `scripts/apply-migration.mjs` existe pero no lleva registro. Es fácil que la base de producción quede desincronizada del repo sin que se note.
- **RLS desactivado.** Como todo pasa por `service_role`, la base no tiene ninguna red de seguridad propia. Activar RLS sería una segunda capa real, pero implica rehacer el acceso a datos.
- **Sin paginación en varios listados.** `/api/admin/companies`, `/api/admin/users`, `/api/task-folders`, `/api/manager/status-requests` y `/api/manager/file-requests` devuelven todas las filas. Con volumen crecerá el tiempo de respuesta hasta agotar el timeout.

### Documentación desactualizada

- `README.md` indica aplicar solo la primera migración y el seed; **faltan nueve migraciones**.
- `README.md` publica las credenciales del administrador inicial (`admin@taskkeep.local` / `Cambiar123!`). Es aceptable para desarrollo, pero hay que confirmar que esa cuenta ya no exista en producción o tenga otra contraseña.
- `IMPLEMENTATION_REPORT.md` (15 de junio) es anterior a las carpetas de tareas y a buena parte del trabajo de Drive. Su sección "Producción" sigue vigente como lista de pendientes.
- `.env.example` lista 14 variables que el código no lee (ver `docs/DEPLOY.md`).
- `codex.md` (1.026 líneas) es el documento de especificación original; hay que revisar si sigue reflejando el producto o quedó como registro histórico.

### Funcionalidad no implementada

Cosas que probablemente se esperan de un producto así y hoy no existen:

- **Desactivar una cuenta sin eliminarla.** La columna `is_active` existe, el listado la filtra y el login la respeta, pero **ningún endpoint la modifica**: no hay forma de desactivar a alguien desde la interfaz. Lo mismo con cambiar el rol de un usuario ya creado (`updateUserSchema` solo admite nombre, email y contraseña).
- Notificaciones dentro de la aplicación (todo va por correo).
- Exportar tareas o informes (CSV/PDF).
- Métricas o panel de productividad por persona.
- Adjuntar archivos sin Google Drive (hoy Drive es obligatorio para adjuntar algo).
- Aplicación móvil o PWA; la interfaz es responsive pero no instalable.

## Cómo continuar

**Antes de tocar nada**, revisar el documento de auditoría (fuera del repositorio):
su sección final es la lista de tareas priorizada.

Para entender el código, el recorrido más eficiente es:

1. `src/lib/api.ts` — cómo se autoriza cada endpoint.
2. `src/app/api/tasks/[id]/route.ts` — el endpoint más completo; concentra las reglas de permisos por rol.
3. `src/lib/tasks/schedule-reminders.ts` — la parte menos obvia del sistema; está bien comentada.
4. `supabase/migrations/202606090001_initial_schema.sql` — el modelo de datos.

Comandos:

```bash
npm install
npm run dev                # http://localhost:3000
npm run lint
npm run build
npm run test:smoke         # requiere TEST_* en el entorno
docker compose -f compose.yml -f compose.dev.yml up --build
```
