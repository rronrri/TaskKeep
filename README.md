# TaskKeep Empresarial

Aplicación monolítica con Next.js 16, React 19, TypeScript, Tailwind CSS y Supabase para gestionar empresas, usuarios, tareas, aprobaciones, archivos y recordatorios.

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
- `GOOGLE_PRIVATE_KEY`: solo servidor.
- `CRON_SECRET`: protege el endpoint de recordatorios.
- `APP_URL`: URL HTTPS pública en producción.

## Base de datos

1. Ejecuta `supabase/migrations/202606090001_initial_schema.sql` en Supabase.
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

## Producción

La imagen es portable a cualquier servicio compatible con contenedores. En producción:

1. Publica una imagen versionada, no dependas únicamente de la etiqueta `latest`.
2. Inyecta secretos durante el arranque.
3. Coloca el servicio detrás de HTTPS mediante un balanceador o proxy inverso.
4. Expón únicamente el puerto HTTP de la aplicación.
5. Usa `/api/health` para probes de vida.
6. Conserva Supabase y Google Drive como servicios externos; el contenedor es efímero.
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
