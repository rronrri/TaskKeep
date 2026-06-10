# CODEX.md — Especificación técnica del proyecto

## 1. Nombre del proyecto

**TaskKeep Empresarial**

Sistema web tipo Google Keep para gestión de tareas, recordatorios, responsables, archivos adjuntos y notificaciones por correo, orientado a empresas con roles jerárquicos.

---

## 2. Objetivo general

Desarrollar una aplicación web monolítica con **Node.js, React, TypeScript y Tailwind CSS**, desplegable en **Vercel Hobby**, que permita a un administrador controlar empresas, gestores y colaboradores; a los gestores crear y administrar tareas/recordatorios; y a los colaboradores visualizar y actualizar el estado de las tareas asignadas bajo reglas de aprobación e historial.

---

## 3. Stack obligatorio

### Frontend

- React
- TypeScript
- Tailwind CSS
- FullCalendar para visualización de calendarios
- React Hook Form para formularios
- Zod para validación de datos
- TanStack Query para cacheo y sincronización de datos
- Componentes accesibles con Radix UI o Headless UI

### Backend

- Node.js
- API Routes de Next.js o servidor Node integrado dentro del monolito
- TypeScript
- JWT para autenticación
- Supabase con PostgreSQL como base de datos
- Supabase Storage o Google Drive API para archivos, según el flujo definido
- Resend + React Email para correos

### Base de datos

- Supabase PostgreSQL
- Row Level Security activado en tablas sensibles
- Migraciones SQL versionadas

### Despliegue

- Vercel Hobby
- Variables de entorno seguras
- Funciones serverless optimizadas
- Cron externo o Vercel Cron si las limitaciones del plan lo permiten

---

## 4. Consideraciones importantes para Vercel Hobby

El proyecto debe diseñarse considerando las limitaciones del plan gratuito de Vercel:

1. Evitar procesos largos en servidor.
2. No depender de workers persistentes.
3. No mantener conexiones WebSocket propias permanentes desde funciones serverless.
4. No ejecutar tareas pesadas dentro de una request HTTP.
5. Usar tareas programadas livianas para recordatorios.
6. Evitar almacenamiento local en el filesystem de Vercel, porque las funciones serverless son efímeras.
7. Los archivos deben guardarse en Google Drive o Supabase Storage, nunca en carpetas locales del servidor.
8. Las notificaciones por correo deben procesarse en endpoints seguros e idempotentes.
9. Las operaciones de carga de archivos deben usar subida directa o endpoints controlados para no exceder tiempos de ejecución.
10. Las consultas deben estar paginadas para evitar respuestas pesadas.

---

## 5. Roles del sistema

### 5.1 Admin

Usuario con control global del sistema.

Permisos:

- Crear empresas.
- Editar empresas.
- Activar o desactivar empresas.
- Crear gestores de empresa.
- Editar gestores.
- Desactivar gestores.
- Crear colaboradores de cualquier empresa.
- Editar colaboradores.
- Desactivar colaboradores.
- Definir límite máximo de gestores por empresa.
- Definir límite máximo de colaboradores por empresa.
- Ver estadísticas globales.
- Ver logs globales.
- Mantener catálogos generales del sistema.

Restricciones:

- No debe eliminar físicamente información crítica.
- Las eliminaciones deben ser lógicas usando `deleted_at` o `is_active`.

---

### 5.2 Gestor de empresa

Usuario responsable de administrar tareas y colaboradores dentro de una empresa específica.

Permisos:

- Crear tareas/recordatorios.
- Editar tareas creadas dentro de su empresa.
- Eliminar lógicamente tareas.
- Asignar responsables a tareas.
- Asignarse tareas a sí mismo.
- Crear colaboradores dentro del límite definido por el admin.
- Editar colaboradores de su empresa.
- Desactivar colaboradores de su empresa.
- Cambiar estado de cualquier tarea de su empresa.
- Aprobar o rechazar cambios de estado solicitados por colaboradores.
- Ver historial de cambios de tareas.
- Ver archivos asociados a tareas.
- Filtrar y ordenar tareas.
- Fijar tareas.
- Cambiar color de tareas.

Restricciones:

- No puede superar el límite de colaboradores definido para su empresa.
- No puede superar el límite de gestores definido para su empresa.
- No puede acceder a empresas ajenas.
- No puede crear otros gestores si esa acción queda reservada al admin.

---

### 5.3 Colaborador

Usuario asignado a una empresa y gestionado por un gestor.

Permisos:

- Ver tareas asignadas a él.
- Ver detalles de sus tareas.
- Descargar o abrir archivos asociados a sus tareas.
- Proponer cambio de estado de tarea.
- Comentar en tareas asignadas.
- Filtrar sus tareas por fecha, deadline, prioridad y estado.
- Visualizar calendario de sus deadlines.

Restricciones:

- No puede crear tareas, salvo que se habilite explícitamente en configuración futura.
- No puede editar datos principales de la tarea.
- No puede eliminar tareas.
- No puede cambiar definitivamente el estado de una tarea sin generar historial para aprobación del gestor.
- No puede acceder a tareas que no le fueron asignadas.
- No puede ver colaboradores ajenos si no es necesario.

---

## 6. Módulos del sistema

### 6.1 Módulo Admin

Rutas sugeridas:

```txt
/admin/dashboard
/admin/companies
/admin/companies/new
/admin/companies/[id]
/admin/managers
/admin/collaborators
/admin/logs
/admin/settings
```

Funciones:

- Dashboard general.
- CRUD lógico de empresas.
- CRUD lógico de gestores.
- CRUD lógico de colaboradores.
- Configuración de límites por empresa.
- Visualización de auditoría.
- Búsqueda global.
- Filtros por empresa, rol, estado y fecha.

---

### 6.2 Módulo Gestor de Empresa

Rutas sugeridas:

```txt
/manager/dashboard
/manager/tasks
/manager/tasks/new
/manager/tasks/[id]
/manager/calendar
/manager/collaborators
/manager/status-requests
/manager/logs
/manager/settings
```

Funciones:

- Dashboard de tareas.
- Crear tarjetas de recordatorio.
- Editar tareas.
- Asignar responsables.
- Adjuntar archivos.
- Gestionar colaboradores.
- Ver solicitudes de cambio de estado.
- Aprobar o rechazar cambios propuestos por colaboradores.
- Ver calendario con FullCalendar.
- Filtrar tareas.
- Fijar tareas.
- Cambiar colores.

---

### 6.3 Módulo Colaborador

Rutas sugeridas:

```txt
/collaborator/dashboard
/collaborator/tasks
/collaborator/tasks/[id]
/collaborator/calendar
/collaborator/profile
```

Funciones:

- Ver tareas asignadas.
- Ver detalle de tarea.
- Proponer cambio de estado.
- Comentar tareas.
- Ver archivos adjuntos.
- Ver calendario de deadlines.
- Filtrar tareas.

---

## 7. Tarjeta de tarea / recordatorio

Cada tarea debe contener:

| Campo | Tipo | Requerido | Descripción |
|---|---:|---:|---|
| Nombre | Texto | Sí | Título corto de la tarea |
| Descripción | Texto largo | No | Detalle opcional |
| Responsable | Combo box | Sí | Gestor o colaborador de la empresa |
| Deadline | Calendario | Sí | Fecha límite |
| Prioridad | Select | Sí | Baja, media, alta, crítica |
| Estado | Select | Sí | Pendiente, en transcurso, completado |
| Archivos | File upload | No | Archivos guardados en Google Drive |
| Color | Color picker | No | Color visual de la tarjeta |
| Fijada | Boolean | No | Permite destacar la tarea |

Estados válidos:

```txt
pending
in_progress
completed
```

Prioridades válidas:

```txt
low
medium
high
critical
```

---

## 8. Flujo de cambio de estado

### 8.1 Cuando el gestor cambia el estado

1. El gestor abre una tarea.
2. Selecciona el nuevo estado.
3. El sistema actualiza la tarea directamente.
4. El sistema crea un registro en `task_status_logs`.
5. La interfaz muestra visualmente que la tarea fue editada.
6. Se actualiza el listado y el calendario.

### 8.2 Cuando el colaborador cambia el estado

1. El colaborador abre una tarea asignada.
2. Selecciona un nuevo estado.
3. El sistema no modifica definitivamente el estado principal.
4. Se crea una solicitud en `task_status_requests`.
5. El gestor recibe la solicitud en su módulo.
6. El gestor puede aprobar o rechazar.
7. Si aprueba, se actualiza el estado real de la tarea.
8. Si rechaza, se mantiene el estado anterior.
9. Todo queda registrado en historial.

Estados de solicitud:

```txt
pending_review
approved
rejected
```

---

## 9. Recordatorios por correo

Los correos deben enviarse al responsable de la tarea:

- 7 días antes del deadline.
- 3 días antes del deadline.
- 1 día antes del deadline.

### Reglas

1. No se debe enviar el mismo recordatorio dos veces.
2. Cada envío debe registrarse en `notification_logs`.
3. Si la tarea está completada, no se envían recordatorios futuros.
4. Si el responsable cambia, los siguientes recordatorios se envían al nuevo responsable.
5. Si el deadline cambia, se recalculan los recordatorios pendientes.
6. Los correos deben usar plantillas de React Email.
7. El envío debe hacerse con Resend.

### Estrategia recomendada para Vercel Hobby

Usar un endpoint seguro:

```txt
/api/cron/send-reminders
```

Este endpoint debe:

1. Validar un secreto `CRON_SECRET`.
2. Buscar tareas con deadlines próximos.
3. Verificar si ya se envió cada tipo de recordatorio.
4. Enviar correos usando Resend.
5. Registrar cada intento en `notification_logs`.
6. Ser idempotente.

Si Vercel Cron no resulta suficiente para el plan, usar un cron externo gratuito como GitHub Actions, cron-job.org o Supabase Scheduled Functions llamando al endpoint seguro.

---

## 10. Archivos adjuntos con Google Drive API

### Reglas

1. Los archivos no deben guardarse localmente en Vercel.
2. Cada empresa debe tener una carpeta raíz en Google Drive.
3. Cada tarea debe tener una subcarpeta propia.
4. Los archivos subidos deben guardarse en la carpeta de la tarea.
5. El sistema debe guardar el enlace de acceso en la base de datos.
6. Se debe guardar también `drive_file_id`.
7. El acceso al link debe configurarse según la política del proyecto.

### Estructura sugerida en Google Drive

```txt
TaskKeep Empresarial/
  Empresa A/
    Tarea 001 - Nombre de tarea/
      archivo1.pdf
      imagen1.png
  Empresa B/
    Tarea 002 - Nombre de tarea/
      documento.docx
```

### Tabla relacionada

```txt
task_files
```

Campos principales:

- `id`
- `task_id`
- `file_name`
- `mime_type`
- `file_size`
- `drive_file_id`
- `drive_web_url`
- `uploaded_by`
- `created_at`

---

## 11. Listado y filtrado de tareas

Debe existir filtrado por:

- Fecha de creación.
- Deadline.
- Prioridad.
- Estado.
- Responsable.
- Empresa, solo para admin.
- Tareas fijadas.
- Color.

Ordenamientos requeridos:

- Más recientes.
- Más antiguas.
- Deadline más cercano.
- Prioridad más alta.
- Estado.

Debe existir paginación.

---

## 12. Personalización visual de tareas

Cada tarjeta debe permitir:

- Fijar o desfijar.
- Cambiar color.
- Mostrar etiqueta de prioridad.
- Mostrar estado visual.
- Mostrar responsable.
- Mostrar deadline.
- Mostrar indicador de archivos adjuntos.
- Mostrar si tiene solicitudes pendientes.

La interfaz debe diferenciar visualmente:

- Tarea vencida.
- Tarea próxima a vencer.
- Tarea completada.
- Tarea pendiente de revisión.

---

## 13. Arquitectura monolítica recomendada

Usar una arquitectura monolítica modular.

Estructura sugerida:

```txt
src/
  app/
    api/
      auth/
      admin/
      manager/
      collaborator/
      tasks/
      files/
      cron/
    admin/
    manager/
    collaborator/
    login/
  components/
    ui/
    forms/
    layout/
    task/
    calendar/
  emails/
    TaskReminderEmail.tsx
    StatusRequestEmail.tsx
  features/
    auth/
    companies/
    users/
    tasks/
    reminders/
    files/
    audit/
  lib/
    supabase/
    auth/
    resend/
    google-drive/
    rate-limit/
    validators/
    permissions/
    dates/
  server/
    services/
      auth.service.ts
      company.service.ts
      user.service.ts
      task.service.ts
      reminder.service.ts
      file.service.ts
      audit.service.ts
    repositories/
      company.repository.ts
      user.repository.ts
      task.repository.ts
      reminder.repository.ts
      file.repository.ts
    policies/
      permissions.ts
  styles/
  types/
  middleware.ts
supabase/
  migrations/
  seed.sql
.env.example
README.md
CODEX.md
```

---

## 14. Base de datos sugerida

### 14.1 Tabla `companies`

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  max_managers integer not null default 1,
  max_collaborators integer not null default 10,
  drive_folder_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 14.2 Tabla `users`

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'manager', 'collaborator')),
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 14.3 Tabla `tasks`

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  created_by uuid not null references users(id),
  responsible_id uuid not null references users(id),
  title text not null,
  description text,
  deadline timestamptz not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  color text,
  is_pinned boolean not null default false,
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 14.4 Tabla `task_files`

```sql
create table task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  uploaded_by uuid not null references users(id),
  file_name text not null,
  mime_type text,
  file_size bigint,
  drive_file_id text not null,
  drive_web_url text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 14.5 Tabla `task_comments`

```sql
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  user_id uuid not null references users(id),
  comment text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 14.6 Tabla `task_status_requests`

```sql
create table task_status_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  requested_by uuid not null references users(id),
  old_status text not null,
  requested_status text not null,
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  manager_comment text,
  created_at timestamptz not null default now()
);
```

### 14.7 Tabla `task_status_logs`

```sql
create table task_status_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  changed_by uuid not null references users(id),
  old_status text not null,
  new_status text not null,
  source text not null check (source in ('manager_direct', 'collaborator_request_approved')),
  created_at timestamptz not null default now()
);
```

### 14.8 Tabla `notification_logs`

```sql
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  user_id uuid not null references users(id),
  notification_type text not null check (notification_type in ('deadline_7_days', 'deadline_3_days', 'deadline_1_day')),
  email text not null,
  status text not null check (status in ('sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now(),
  unique(task_id, user_id, notification_type)
);
```

### 14.9 Tabla `audit_logs`

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  company_id uuid references companies(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
```

---

## 15. Seguridad

### 15.1 Autenticación

- Inicio de sesión con email y contraseña.
- Contraseñas hasheadas con Argon2 o bcrypt.
- JWT firmado con secreto seguro.
- JWT almacenado preferiblemente en cookie `httpOnly`, `secure` y `sameSite=strict`.
- Expiración corta del access token.
- Refresh token si se implementa sesión extendida.
- Cierre de sesión invalidando cookie.

### 15.2 Autorización

- Middleware global para proteger rutas.
- Validación de rol por endpoint.
- Validación de pertenencia a empresa.
- Policies centralizadas en `permissions.ts`.
- Row Level Security en Supabase para defensa adicional.

### 15.3 Validación contra SQL Injection

- Nunca construir SQL concatenando strings del usuario.
- Usar Supabase client, queries parametrizadas o RPC seguras.
- Validar todos los formularios con Zod.
- Validar datos en frontend y backend.
- Sanitizar campos de texto antes de renderizar HTML.

### 15.4 Rate limiting

Implementar límite de requests en:

- Login.
- Registro/creación de usuarios.
- Subida de archivos.
- Endpoint de cron.
- Cambio de estado.
- Comentarios.

Recomendación:

- Upstash Redis para rate limit si se permite servicio externo.
- Alternativa simple: rate limit por IP en base de datos, aunque menos eficiente.

### 15.5 Protección adicional

- CSRF protection si se usan cookies.
- CORS restrictivo.
- Headers de seguridad.
- Validación de MIME type en archivos.
- Límite de tamaño por archivo.
- Bloquear extensiones peligrosas.
- Auditoría de acciones sensibles.
- Logs sin exponer contraseñas, tokens ni secretos.
- Variables de entorno fuera del repositorio.

---

## 16. Accesibilidad

El sistema debe cumplir buenas prácticas WCAG básicas:

1. Contraste suficiente entre texto y fondo.
2. Navegación completa por teclado.
3. Estados `focus-visible` claros.
4. Labels asociados a todos los inputs.
5. Textos alternativos para imágenes relevantes.
6. Botones con nombres accesibles.
7. No depender únicamente del color para comunicar estado.
8. Mensajes de error claros junto al campo correspondiente.
9. Componentes de modal accesibles.
10. FullCalendar debe tener alternativa en lista para usuarios que no naveguen bien calendarios visuales.
11. Confirmaciones visuales y textuales al actualizar tareas.
12. Diseño responsive para móvil, tablet y escritorio.

---

## 17. Endpoints sugeridos

### Auth

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Admin

```txt
GET    /api/admin/companies
POST   /api/admin/companies
PATCH  /api/admin/companies/:id
DELETE /api/admin/companies/:id

GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
```

### Gestor

```txt
GET    /api/manager/tasks
POST   /api/manager/tasks
PATCH  /api/manager/tasks/:id
DELETE /api/manager/tasks/:id

GET    /api/manager/collaborators
POST   /api/manager/collaborators
PATCH  /api/manager/collaborators/:id
DELETE /api/manager/collaborators/:id

GET    /api/manager/status-requests
POST   /api/manager/status-requests/:id/approve
POST   /api/manager/status-requests/:id/reject
```

### Colaborador

```txt
GET  /api/collaborator/tasks
GET  /api/collaborator/tasks/:id
POST /api/collaborator/tasks/:id/status-request
POST /api/collaborator/tasks/:id/comments
```

### Archivos

```txt
POST /api/files/upload
GET  /api/files/:id
DELETE /api/files/:id
```

### Cron

```txt
POST /api/cron/send-reminders
```

---

## 18. Variables de entorno

Crear `.env.example` con:

```env
APP_URL="http://localhost:3000"
JWT_SECRET=""
COOKIE_NAME="taskkeep_session"

SUPABASE_URL=""
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

RESEND_API_KEY=""
RESEND_FROM_EMAIL=""

GOOGLE_CLIENT_EMAIL=""
GOOGLE_PRIVATE_KEY=""
GOOGLE_DRIVE_ROOT_FOLDER_ID=""

CRON_SECRET=""
RATE_LIMIT_SECRET=""
```

Reglas:

- `SUPABASE_SERVICE_ROLE_KEY` solo debe usarse en backend.
- Nunca exponer claves privadas al frontend.
- Las variables públicas deben iniciar con `NEXT_PUBLIC_` solo si realmente son públicas.

---

## 19. Reglas de negocio críticas

1. Una empresa no puede tener más gestores que `max_managers`.
2. Una empresa no puede tener más colaboradores que `max_collaborators`.
3. Un gestor solo administra su empresa.
4. Un colaborador solo ve sus tareas asignadas.
5. Una tarea siempre debe tener responsable.
6. Una tarea completada no debe recibir recordatorios.
7. El colaborador no cambia directamente el estado final; crea solicitud.
8. El gestor sí puede cambiar estados directamente.
9. Todo cambio de estado debe generar log.
10. Toda acción sensible debe generar auditoría.
11. Toda eliminación debe ser lógica.
12. Los archivos deben quedar asociados a tarea, usuario y empresa.
13. Los links de archivos deben mostrarse después de subir correctamente.
14. No se deben duplicar correos de recordatorio.

---

## 20. UI mínima requerida

### Login

- Email.
- Contraseña.
- Validaciones.
- Mensaje de error genérico.

### Dashboard admin

- Total empresas.
- Total gestores.
- Total colaboradores.
- Empresas activas/inactivas.
- Últimas acciones.

### Dashboard gestor

- Tareas pendientes.
- Tareas en transcurso.
- Tareas completadas.
- Tareas vencidas.
- Solicitudes de estado pendientes.
- Calendario resumido.

### Dashboard colaborador

- Mis tareas pendientes.
- Mis tareas próximas a vencer.
- Mis tareas completadas.
- Calendario personal.

### Tarjetas

- Diseño tipo Keep.
- Color editable.
- Pin visible.
- Estado visible.
- Prioridad visible.
- Responsable visible.
- Deadline visible.
- Acciones según rol.

---

## 21. Criterios de aceptación

El proyecto se considera funcional cuando:

1. El admin puede crear una empresa con límites.
2. El admin puede crear gestores respetando el límite.
3. El gestor puede crear colaboradores respetando el límite.
4. El gestor puede crear tareas con responsable, deadline y prioridad.
5. El gestor puede adjuntar archivos y ver el link de Google Drive.
6. El colaborador puede ver solo sus tareas.
7. El colaborador puede solicitar cambio de estado.
8. El gestor puede aprobar o rechazar la solicitud.
9. El historial muestra los cambios de estado.
10. Los recordatorios se envían 7, 3 y 1 día antes.
11. No se duplican recordatorios.
12. Los filtros funcionan correctamente.
13. Las tareas fijadas aparecen destacadas.
14. Los colores personalizados se conservan.
15. Las rutas están protegidas por rol.
16. Los formularios tienen validación frontend y backend.
17. El sistema funciona en Vercel Hobby sin almacenamiento local.
18. La interfaz es responsive y accesible.

---

## 22. Recomendaciones finales de implementación

1. Usar Next.js con App Router para simplificar frontend, backend y despliegue en Vercel.
2. Separar lógica de negocio en servicios y repositorios.
3. No poner lógica compleja dentro de componentes React.
4. Crear validadores Zod compartidos entre frontend y backend.
5. Implementar primero autenticación y roles.
6. Luego empresas y usuarios.
7. Luego tareas.
8. Luego historial de estados.
9. Luego archivos.
10. Luego recordatorios.
11. Finalmente accesibilidad, auditoría, rate limit y optimización.

---

## 23. Orden recomendado de desarrollo

### Fase 1 — Base del proyecto

- Crear proyecto Next.js con TypeScript.
- Configurar Tailwind.
- Configurar ESLint y Prettier.
- Configurar Supabase.
- Crear variables de entorno.
- Crear layout base.

### Fase 2 — Autenticación

- Crear tabla de usuarios.
- Implementar login.
- Crear JWT.
- Proteger rutas.
- Redireccionar según rol.

### Fase 3 — Admin

- CRUD lógico de empresas.
- CRUD lógico de gestores.
- CRUD lógico de colaboradores.
- Validación de límites.

### Fase 4 — Gestor

- CRUD de tareas.
- Gestión de colaboradores.
- Filtros.
- Tareas fijadas.
- Colores.

### Fase 5 — Colaborador

- Vista de tareas asignadas.
- Solicitud de cambio de estado.
- Comentarios.

### Fase 6 — Archivos

- Integración Google Drive API.
- Crear carpetas por empresa y tarea.
- Subir archivos.
- Guardar links.

### Fase 7 — Recordatorios

- Plantillas React Email.
- Integración Resend.
- Endpoint cron.
- Logs de notificación.

### Fase 8 — Seguridad y accesibilidad

- Rate limit.
- Auditoría.
- RLS.
- Headers de seguridad.
- Revisión responsive.
- Revisión WCAG básica.

---

## 24. Definición final para Codex

Codex debe implementar el proyecto siguiendo estrictamente esta especificación, manteniendo una arquitectura monolítica modular, código TypeScript tipado, validaciones robustas, separación clara entre UI, servicios, repositorios y políticas de permisos. El sistema debe estar optimizado para Vercel Hobby, sin almacenamiento local persistente, con recordatorios idempotentes, control de roles, historial de cambios, accesibilidad y medidas básicas de seguridad desde el inicio.
