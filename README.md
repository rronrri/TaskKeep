# TaskKeep Empresarial

Aplicación monolítica con Next.js 16, React 19, TypeScript, Tailwind CSS y Supabase para gestionar empresas, usuarios, tareas, aprobaciones, archivos y recordatorios.

Las tarjetas usan colores predeterminados según su prioridad: verde para baja,
amarillo para media, naranja para alta y rojo para crítica.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/ESTADO-DEL-PROYECTO.md`](docs/ESTADO-DEL-PROYECTO.md) | **Empezar por acá.** Estado actual, arquitectura, qué está terminado y qué falta. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Despliegue en Vercel, variables de entorno y checklist de verificación. |
| [`docs/superpowers/`](docs/superpowers/) | Spec y plan del rediseño visual «Expediente». |
| [`GOOGLE_DRIVE_SETUP.md`](GOOGLE_DRIVE_SETUP.md) | Configuración de Google Cloud para Drive y Picker. |
| [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) | Reporte del 15/06/2026. Desactualizado; se conserva como registro histórico. |

## Inicio rápido con Docker

El modo recomendado para trabajar con recarga automática es:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

Abre `http://localhost:3000`. Para detenerlo:

```bash
docker compose -f compose.yml -f compose.dev.yml down
```

También están disponibles:

```bash
npm run docker:dev
npm run docker:down
```

El código se monta dentro del contenedor. `node_modules` y `.next` permanecen en volúmenes Docker para evitar conflictos con Windows.

## Ejecución tipo producción

Construye y levanta la imagen optimizada:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

La imagen usa la salida standalone de Next.js, se ejecuta como usuario no privilegiado y expone un healthcheck en `/api/health`.

Para apagarla:

```bash
docker compose down
```

## Variables y secretos

En local, Compose carga `.env.local`. Este archivo está ignorado por Git y excluido del contexto de Docker, por lo que sus secretos no se copian dentro de la imagen.

Para producción crea un archivo externo, por ejemplo `.env.production`, y selecciónalo antes de arrancar:

```powershell
$env:ENV_FILE=".env.production"
docker compose up --build -d
```

En Linux:

```bash
ENV_FILE=.env.production docker compose up --build -d
```

No publiques ni incorpores archivos de entorno a la imagen. En plataformas gestionadas usa el almacén de secretos del proveedor.

Variables críticas:

- `JWT_SECRET`: mínimo 32 caracteres aleatorios.
- `SUPABASE_SERVICE_ROLE_KEY`: solo servidor.
- `POSTGRES_PASSWORD` y URLs PostgreSQL: solo servidor.
- `RESEND_API_KEY`: solo servidor.
- `CRON_SECRET`: protege el endpoint de recordatorios.
- `APP_URL`: URL HTTPS pública en producción.
- `COOKIE_SECURE`: usa `false` en HTTP local y `true` detrás de HTTPS. Si se omite, se deduce de `APP_URL`.

## Base de datos

1. Ejecuta **todas** las migraciones de `supabase/migrations/` en el editor SQL de
   Supabase, en orden alfabético (son 10, desde `202606090001_initial_schema.sql`
   hasta `202606220001_task_folders.sql`). Vercel no las aplica solo.
2. Ejecuta `supabase/seed.sql`.
3. Cambia inmediatamente la contraseña del administrador inicial.

Credenciales iniciales de desarrollo:

```txt
admin@taskkeep.local
Cambiar123!
```

La base de datos permanece en Supabase. Compose no levanta una segunda instancia PostgreSQL para evitar diferencias entre desarrollo y producción.

## Recordatorios

Programa una llamada diaria:

```http
POST /api/cron/send-reminders
Authorization: Bearer <CRON_SECRET>
```

Puede utilizarse Vercel Cron, GitHub Actions, cron-job.org, Supabase Scheduled Functions o el planificador de la plataforma donde se ejecute el contenedor.

Solo se procesan tareas con recordatorios habilitados. Cada tarea puede usar avisos diarios, mensuales o avisos 5, 3 y 1 día antes de su fecha límite. Cuando un/a gestor/a asigna una tarea a un/a colaborador/a, ambos reciben el aviso.

## Google Drive

Google Drive funciona por empresa:

1. El/la gestor/a conecta su cuenta desde **Mi perfil**.
2. Pega el enlace de una carpeta raíz de Drive.
3. TaskKeep valida el acceso y guarda esa carpeta en la empresa.
4. Los colaboradores/as heredan esa carpeta automáticamente.
5. Cada tarea crea una carpeta propia `TK-... - nombre de tarea`.
6. Los archivos de colaboradores/as se suben a `Pendientes` y luego el/la gestor/a los aprueba o rechaza.
7. Al aprobar, el archivo se mueve a la carpeta principal de la tarea o a una subcarpeta elegida.

Variables necesarias:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NEXT_PUBLIC_GOOGLE_API_KEY`
- `NEXT_PUBLIC_GOOGLE_APP_ID`

En producción agrega el dominio HTTPS y `/api/google/callback` en los orígenes y redirects autorizados de Google Cloud.

## Producción

La imagen es portable a cualquier servicio compatible con contenedores. En producción:

1. Publica una imagen versionada, no dependas únicamente de la etiqueta `latest`.
2. Inyecta secretos durante el arranque.
3. Coloca el servicio detrás de HTTPS mediante un balanceador o proxy inverso.
4. Expón únicamente el puerto HTTP de la aplicación.
5. Usa `/api/health` para probes de vida.
6. Conserva Supabase como servicio externo; el contenedor es efímero.
7. Centraliza logs y configura reinicios automáticos.
8. Ejecuta las migraciones como una tarea separada antes de desplegar una versión que las requiera.

Para Vercel no es necesario usar Docker: el mismo proyecto puede desplegarse directamente configurando las variables del entorno.

## Verificación sin Docker

```bash
npm install
npm run lint
npm run build
npm run start
```
