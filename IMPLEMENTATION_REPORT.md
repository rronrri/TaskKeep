# Reporte de implementación

Fecha de revisión: 15 de junio de 2026.

## Funcionalidad terminada

- Roles y permisos para administrador/a, gestor/a y colaborador/a.
- Contraseña temporal con cambio obligatorio.
- Empresas, límites y eliminación permanente.
- Creación, edición y eliminación permanente de cuentas.
- Auditoría con ventana modal de detalle.
- Tareas en tarjetas/lista, filtros, calendario, prioridad y fijado.
- Gestores/as asignan tareas a su equipo.
- Colaboradores/as reciben asignaciones y crean tareas personales solo para sí mismos/as.
- Comentarios, historial y solicitudes de cambio de estado.
- Google Drive por empresa: gestor/a conecta OAuth, configura carpeta raíz, colaboradores/as heredan la carpeta y los archivos se organizan por tarea.
- Carga, aprobación, rechazo y movimiento de archivos a carpeta/subcarpeta de Drive.
- Recordatorios opcionales diarios, mensuales o 5, 3 y 1 día antes de la fecha límite.
- Aviso adicional al gestor/a cuando la tarea pertenece a un/a colaborador/a.
- Recuperación de contraseña, Resend, cron, Docker y healthcheck.

## Producción

- Verificar dominio/remitente en Resend.
- Configurar `APP_URL` con HTTPS y `COOKIE_SECURE=true`.
- Rotar las claves compartidas durante desarrollo.
- Confirmar Vercel Cron y observabilidad.
- Sustituir rate limit en memoria por Redis si se usan varias instancias.
