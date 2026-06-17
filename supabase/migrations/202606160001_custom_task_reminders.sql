alter table public.tasks
  add column if not exists reminder_settings jsonb not null default '{}'::jsonb;

update public.tasks
set reminder_settings = case
  when reminder_mode = 'deadline' and reminders_enabled then '{"deadline_offsets":[7200,4320,1440]}'::jsonb
  when reminder_mode = 'daily' then '{"recurring_time":"09:00","timezone_offset_minutes":0}'::jsonb
  when reminder_mode = 'monthly' then '{"recurring_time":"09:00","monthly_day":1,"timezone_offset_minutes":0}'::jsonb
  else '{}'::jsonb
end
where reminder_settings = '{}'::jsonb;

alter table public.notification_logs
  drop constraint if exists notification_logs_notification_type_check;

alter table public.notification_logs
  add constraint notification_logs_notification_type_check
  check (notification_type in (
    'deadline_7_days',
    'deadline_5_days',
    'deadline_3_days',
    'deadline_1_day',
    'deadline_custom',
    'daily',
    'monthly'
  ));
