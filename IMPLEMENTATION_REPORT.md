# Reporte de implementación

Fecha de revisión: 12 de junio de 2026.

## Estado general

TaskKeep dispone de los flujos visibles principales para administración, gestoras y
colaboradoras. La aplicación compila en modo producción, se ejecuta en Docker y
cuenta con una prueba de integración reutilizable.

## Funcionalidad terminada

### Experiencia de usuario

- Dashboards con métricas reales por rol.
- Próximas tareas, vencidas, próximas a vencer y solicitudes pendientes.
- Tareas en tarjetas o lista.
- Búsqueda, filtros por estado, prioridad, responsable, deadline y fijadas.
- Ordenamiento y paginación.
- Calendario interactivo con vista previa y apertura de tareas.
- Creación y edición mediante modales accesibles.
- Fijado directo desde el tablero.
- Colores predeterminados por prioridad.

### Detalle de tareas

- Vista completa dentro de un modal.
- Comentarios para gestoras y colaboradoras.
- Historial de cambios de estado.
- Historial de solicitudes aprobadas o rechazadas.
- Listado y apertura de archivos adjuntos.
- Subida de archivos para gestoras y pasantes cuando Drive está configurado.
- Los archivos de pasantes quedan pendientes de aprobación.
- Las gestoras pueden aprobar o rechazar archivos con un comentario.
- Los pasantes consultan el estado y comentario de sus propios archivos.
- Eliminación de archivos según autor y rol.
- Creación automática de carpetas de empresa y tarea en Google Drive.

### Cuenta y autenticación

- Inicio y cierre de sesión mediante JWT en cookie HTTP-only.
- Cookie segura deducida de `APP_URL` o configurable con `COOKIE_SECURE`.
- Perfil editable para todos los roles.
- Cambio de contraseña verificando la contraseña actual.
- Contraseña temporal marcada para cambio al primer acceso.
- Recuperación por correo con token de un solo uso y vencimiento de 30 minutos.

### Administración

- Empresas con límites de gestoras y colaboradoras.
- Creación, edición y eliminación de empresas.
- Creación, edición, desactivación y reactivación de cuentas.
- Búsqueda y filtros de personas.
- Correo de bienvenida.
- Auditoría visible de acciones sensibles.
- Pantalla de estado de integraciones.
- Pantalla de entregas y errores de recordatorios.

### Operación y seguridad

- Control de roles y pertenencia a empresa.
- Validación Zod en frontend y backend.
- Rate limiting básico en login, recuperación, archivos, comentarios y solicitudes.
- Validación de origen en operaciones mutables sensibles.
- Cabeceras CSP, anti-frame, MIME, referrer y permisos.
- Historial y auditoría para empresas, cuentas, tareas, comentarios y aprobaciones.
- Recordatorios idempotentes a 7, 3 y 1 día.
- Programación diaria incluida en `vercel.json`.
- RLS habilitado; el backend usa exclusivamente la service role y autorización propia.
- Migraciones SQL versionadas.

### Calidad

- `npm run lint`.
- `npm run build`.
- `npm run test:smoke`.
- Healthcheck Docker en `/api/health`.

## Dependencias externas pendientes

Estas partes no pueden activarse solo con código:

1. **Google Drive**
   - La interfaz y el flujo están implementados.
   - Falta proporcionar `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` y
     `GOOGLE_DRIVE_ROOT_FOLDER_ID` válidos.
   - Un OAuth Client ID por sí solo no permite al servidor subir archivos.

2. **Correo**
   - Bienvenida, recuperación y recordatorios están implementados.
   - Para entrega real se debe verificar el dominio/remitente configurado en Resend.

3. **Producción**
   - Rotar todas las claves compartidas durante desarrollo.
   - Configurar `APP_URL` con HTTPS, `COOKIE_SECURE=true` y secretos definitivos.
   - Confirmar que Vercel Cron esté habilitado en el proyecto desplegado.
   - Configurar observabilidad centralizada del proveedor de despliegue.

## Mejoras técnicas no bloqueantes

- Ampliar las pruebas automatizadas con navegador cuando exista un entorno CI.
- Sustituir el rate limit en memoria por Upstash Redis para múltiples instancias.
- Revisar periódicamente `npm audit` y actualizar dependencias obsoletas.
- Migrar gradualmente las cargas de datos a TanStack Query si se necesita cacheo
  avanzado; actualmente los flujos sincronizan mediante `fetch`.
- Eliminar la columna histórica `tasks.color` en una migración futura.
