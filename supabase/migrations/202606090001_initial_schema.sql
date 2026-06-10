create extension if not exists pgcrypto;

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  max_managers integer not null default 1 check (max_managers > 0),
  max_collaborators integer not null default 10 check (max_collaborators > 0),
  drive_folder_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

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
  deleted_at timestamptz,
  check ((role = 'admin' and company_id is null) or (role <> 'admin' and company_id is not null))
);

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

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  user_id uuid not null references users(id),
  comment text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table task_status_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  requested_by uuid not null references users(id),
  old_status text not null check (old_status in ('pending', 'in_progress', 'completed')),
  requested_status text not null check (requested_status in ('pending', 'in_progress', 'completed')),
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  manager_comment text,
  created_at timestamptz not null default now()
);

create unique index one_pending_status_request_per_task
  on task_status_requests(task_id) where review_status = 'pending_review';

create table task_status_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  changed_by uuid not null references users(id),
  old_status text not null,
  new_status text not null,
  source text not null check (source in ('manager_direct', 'collaborator_request_approved')),
  created_at timestamptz not null default now()
);

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

create index tasks_company_deadline_idx on tasks(company_id, deadline) where deleted_at is null;
create index tasks_responsible_idx on tasks(responsible_id) where deleted_at is null;
create index users_company_role_idx on users(company_id, role) where deleted_at is null;

create or replace function can_add_company_user(target_company_id uuid, target_role text)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_count integer; allowed_count integer;
begin
  if target_role not in ('manager', 'collaborator') then return false; end if;
  select count(*) into current_count from users
    where company_id = target_company_id and role = target_role and is_active and deleted_at is null;
  if target_role = 'manager' then
    select max_managers into allowed_count from companies where id = target_company_id and is_active and deleted_at is null;
  else
    select max_collaborators into allowed_count from companies where id = target_company_id and is_active and deleted_at is null;
  end if;
  return allowed_count is not null and current_count < allowed_count;
end $$;

create or replace function manager_update_task_status(
  target_task_id uuid, actor_id uuid, actor_company_id uuid, next_status text
) returns tasks language plpgsql security definer set search_path = public as $$
declare current_task tasks; previous_status text;
begin
  if next_status not in ('pending', 'in_progress', 'completed') then raise exception 'Estado inválido'; end if;
  select * into current_task from tasks where id = target_task_id and company_id = actor_company_id and deleted_at is null for update;
  if not found then raise exception 'Tarea no encontrada'; end if;
  if current_task.status <> next_status then
    previous_status := current_task.status;
    update tasks set status = next_status, updated_at = now() where id = target_task_id returning * into current_task;
    insert into task_status_logs(task_id, changed_by, old_status, new_status, source)
      values(target_task_id, actor_id, previous_status, next_status, 'manager_direct');
  end if;
  return current_task;
end $$;

create or replace function review_status_request(
  request_id uuid, reviewer_id uuid, reviewer_company_id uuid, decision text, review_comment text
) returns task_status_requests language plpgsql security definer set search_path = public as $$
declare status_request task_status_requests; target_task tasks;
begin
  if decision not in ('approved', 'rejected') then raise exception 'Decisión inválida'; end if;
  select r.* into status_request from task_status_requests r
    join tasks t on t.id = r.task_id
    where r.id = request_id and r.review_status = 'pending_review' and t.company_id = reviewer_company_id
    for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if decision = 'approved' then
    select * into target_task from tasks where id = status_request.task_id for update;
    update tasks set status = status_request.requested_status, updated_at = now() where id = target_task.id;
    insert into task_status_logs(task_id, changed_by, old_status, new_status, source)
      values(target_task.id, reviewer_id, target_task.status, status_request.requested_status, 'collaborator_request_approved');
  end if;
  update task_status_requests set review_status = decision, reviewed_by = reviewer_id,
    reviewed_at = now(), manager_comment = review_comment
    where id = request_id returning * into status_request;
  return status_request;
end $$;

alter table companies enable row level security;
alter table users enable row level security;
alter table tasks enable row level security;
alter table task_files enable row level security;
alter table task_comments enable row level security;
alter table task_status_requests enable row level security;
alter table task_status_logs enable row level security;
alter table notification_logs enable row level security;
alter table audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
