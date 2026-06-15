alter table users
  add column if not exists google_email text,
  add column if not exists google_refresh_token_encrypted text,
  add column if not exists google_connected_at timestamptz,
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text;

alter table tasks
  add column if not exists reminders_enabled boolean not null default false;

alter table notification_logs
  drop constraint if exists notification_logs_notification_type_check;

alter table notification_logs
  add constraint notification_logs_notification_type_check
  check (notification_type in ('deadline_7_days', 'deadline_5_days', 'deadline_3_days', 'deadline_1_day'));

alter table task_status_logs
  drop constraint if exists task_status_logs_source_check;

alter table task_status_logs
  add constraint task_status_logs_source_check
  check (source in ('manager_direct', 'collaborator_request_approved', 'collaborator_self_direct'));

create or replace function delete_user_cascade(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_exists boolean;
begin
  select exists(select 1 from users where id = target_user_id and role <> 'admin')
  into user_exists;

  if not user_exists then
    return false;
  end if;

  delete from notification_logs
  where user_id = target_user_id
     or task_id in (
       select id from tasks
       where created_by = target_user_id or responsible_id = target_user_id
     );

  delete from task_status_logs
  where changed_by = target_user_id
     or task_id in (
       select id from tasks
       where created_by = target_user_id or responsible_id = target_user_id
     );

  delete from task_status_requests
  where requested_by = target_user_id
     or reviewed_by = target_user_id
     or task_id in (
       select id from tasks
       where created_by = target_user_id or responsible_id = target_user_id
     );

  delete from task_comments
  where user_id = target_user_id
     or task_id in (
       select id from tasks
       where created_by = target_user_id or responsible_id = target_user_id
     );

  delete from task_files
  where uploaded_by = target_user_id
     or reviewed_by = target_user_id
     or task_id in (
       select id from tasks
       where created_by = target_user_id or responsible_id = target_user_id
     );

  delete from tasks
  where created_by = target_user_id or responsible_id = target_user_id;

  delete from audit_logs
  where actor_id = target_user_id;

  update users set created_by = null where created_by = target_user_id;
  delete from users where id = target_user_id;
  return true;
end;
$$;

revoke all on function delete_user_cascade(uuid) from anon, authenticated;
