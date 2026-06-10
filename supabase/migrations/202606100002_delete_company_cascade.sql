create or replace function delete_company_cascade(target_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  company_exists boolean;
begin
  select exists(
    select 1 from companies where id = target_company_id
  ) into company_exists;

  if not company_exists then
    return false;
  end if;

  delete from notification_logs
  where task_id in (select id from tasks where company_id = target_company_id)
     or user_id in (select id from users where company_id = target_company_id);

  delete from task_status_logs
  where task_id in (select id from tasks where company_id = target_company_id)
     or changed_by in (select id from users where company_id = target_company_id);

  delete from task_status_requests
  where task_id in (select id from tasks where company_id = target_company_id)
     or requested_by in (select id from users where company_id = target_company_id)
     or reviewed_by in (select id from users where company_id = target_company_id);

  delete from task_comments
  where task_id in (select id from tasks where company_id = target_company_id)
     or user_id in (select id from users where company_id = target_company_id);

  delete from task_files
  where task_id in (select id from tasks where company_id = target_company_id)
     or uploaded_by in (select id from users where company_id = target_company_id);

  delete from tasks where company_id = target_company_id;

  delete from audit_logs
  where company_id = target_company_id
     or actor_id in (select id from users where company_id = target_company_id);

  update users
  set created_by = null
  where created_by in (select id from users where company_id = target_company_id);

  delete from users where company_id = target_company_id;
  delete from companies where id = target_company_id;

  return true;
end;
$$;

revoke all on function delete_company_cascade(uuid) from anon, authenticated;
