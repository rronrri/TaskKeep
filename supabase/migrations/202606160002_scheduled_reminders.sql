-- Recordatorios programados en Resend (scheduledAt): los registros pueden estar
-- "scheduled" (encolados en Resend) o "cancelled" (cancelados tras editar/eliminar/completar).
alter table public.notification_logs
  drop constraint if exists notification_logs_status_check;

alter table public.notification_logs
  add constraint notification_logs_status_check
  check (status in ('sent', 'failed', 'scheduled', 'cancelled'));
