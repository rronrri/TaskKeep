alter table public.tasks
  alter column deadline drop not null,
  add column if not exists reminder_mode text not null default 'none',
  add column if not exists next_reminder_at timestamptz;

update public.tasks
set reminder_mode = case
  when reminders_enabled and deadline is not null then 'deadline'
  else 'none'
end
where reminder_mode = 'none';

alter table public.tasks
  drop constraint if exists tasks_reminder_mode_check;

alter table public.tasks
  add constraint tasks_reminder_mode_check
  check (reminder_mode in ('none', 'daily', 'monthly', 'deadline'));

alter table public.notification_logs
  add column if not exists reminder_key text;

update public.notification_logs
set reminder_key = notification_type
where reminder_key is null;

alter table public.notification_logs
  alter column reminder_key set not null;

alter table public.notification_logs
  drop constraint if exists notification_logs_task_id_user_id_notification_type_key;

alter table public.notification_logs
  drop constraint if exists notification_logs_notification_type_check;

alter table public.notification_logs
  add constraint notification_logs_notification_type_check
  check (notification_type in (
    'deadline_7_days',
    'deadline_5_days',
    'deadline_3_days',
    'deadline_1_day',
    'daily',
    'monthly'
  ));

create unique index if not exists notification_logs_task_user_reminder_key_idx
  on public.notification_logs(task_id, user_id, reminder_key);

create or replace function public.delete_user_cascade(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  select role into target_role
  from public.users
  where id = target_user_id and deleted_at is null;

  if target_role is null then
    return false;
  end if;

  if target_role = 'collaborator' and exists (
    select 1 from public.tasks
    where responsible_id = target_user_id and deleted_at is null
  ) then
    raise exception 'COLLABORATOR_HAS_ASSIGNED_TASKS';
  end if;

  update public.tasks
  set deleted_at = now(), updated_at = now()
  where created_by = target_user_id or responsible_id = target_user_id;

  update public.users
  set deleted_at = now(), updated_at = now()
  where id = target_user_id;

  return true;
end;
$$;
