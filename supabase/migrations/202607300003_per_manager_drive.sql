-- Cada gestor/a tiene su propia conexión de Google Drive, independiente de la
-- de otros/as gestores/as de la misma empresa. Ya no existe una carpeta raíz
-- compartida por empresa ni por gestor/a: cada tarea resuelve su carpeta por
-- separado (ver src/lib/google-drive/resolve-owner.ts), y la carpeta de la
-- tarea se crea directo en "Mi unidad" de quien la posee.
--
-- La conexión de Google en sí (`google_refresh_token_encrypted`, `google_email`,
-- `google_connected_at`) ya vivía en `users` desde antes y no cambia. Lo que se
-- quita es el concepto de "carpeta raíz de la empresa" en `companies`.

alter table public.companies
  drop column if exists drive_folder_id,
  drop column if exists drive_folder_name,
  drop column if exists drive_folder_url,
  drop column if exists drive_owner_user_id,
  drop column if exists drive_connected_at;

-- ── Empresa ──────────────────────────────────────────────────────────────────
-- Ya no hace falta soltar drive_owner_user_id: esa columna no existe más.
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

  -- Antes que los usuarios: task_folders.created_by los referencia.
  delete from task_folders where company_id = target_company_id;

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

-- ── Usuario ──────────────────────────────────────────────────────────────────
-- La conexión de Drive de quien se borra desaparece con su propia fila; ya no
-- hay una carpeta de empresa compartida que limpiar.
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

  delete from audit_logs where actor_id = target_user_id;

  -- La carpeta sobrevive a quien la creó; solo se desvincula.
  update task_folders set created_by = null where created_by = target_user_id;

  -- Si era gestor/a, sus colaboradores/as sobreviven pero quedan sin gestor/a
  -- asignado/a: nadie más los ve ni gestiona hasta que admin los reasigne.
  update users set created_by = null where created_by = target_user_id;

  delete from password_reset_tokens where user_id = target_user_id;
  delete from users where id = target_user_id;

  return true;
end;
$$;

revoke all on function delete_user_cascade(uuid) from anon, authenticated;

-- ── Métricas de adopción ────────────────────────────────────────────────────
-- "Drive configurado" pasa de ser un booleano por empresa a "al menos un/a
-- gestor/a de la empresa conectó su Google".
create or replace function company_adoption_metrics(period_days integer default 30)
returns table (
  company_id uuid,
  company_name text,
  manager_name text,
  manager_email text,
  manager_last_login timestamptz,
  managers_total integer,
  collaborators_total integer,
  collaborators_active integer,
  tasks_created integer,
  tasks_completed integer,
  pending_approvals integer,
  drive_configured boolean,
  last_activity timestamptz
)
language sql
security definer
set search_path = public
as $$
  with period as (
    select now() - make_interval(days => greatest(period_days, 1)) as since
  ),
  lead_manager as (
    select distinct on (u.company_id)
      u.company_id, u.full_name, u.email, u.last_login_at
    from users u
    where u.role = 'manager' and u.deleted_at is null and u.is_active
    order by u.company_id, u.last_login_at desc nulls last, u.created_at asc
  )
  select
    c.id,
    c.name,
    lm.full_name,
    lm.email,
    lm.last_login_at,
    (select count(*)::integer from users m
      where m.company_id = c.id and m.role = 'manager' and m.deleted_at is null and m.is_active),
    (select count(*)::integer from users k
      where k.company_id = c.id and k.role = 'collaborator' and k.deleted_at is null and k.is_active),
    (select count(*)::integer from users k, period p
      where k.company_id = c.id and k.role = 'collaborator' and k.deleted_at is null and k.is_active
        and k.last_login_at >= p.since),
    (select count(*)::integer from tasks t, period p
      where t.company_id = c.id and t.deleted_at is null and t.created_at >= p.since),
    (select count(*)::integer from task_status_logs l, period p
      where l.new_status = 'completed' and l.created_at >= p.since
        and l.task_id in (select id from tasks where company_id = c.id)),
    (select count(*)::integer from task_status_requests r
      where r.review_status = 'pending_review'
        and r.task_id in (select id from tasks where company_id = c.id and deleted_at is null))
    + (select count(*)::integer from task_files f
      where f.approval_status = 'pending' and f.deleted_at is null
        and f.task_id in (select id from tasks where company_id = c.id and deleted_at is null)),
    exists(select 1 from users m2
      where m2.company_id = c.id and m2.role = 'manager' and m2.deleted_at is null and m2.is_active
        and m2.google_refresh_token_encrypted is not null),
    greatest(
      lm.last_login_at,
      (select max(a.created_at) from audit_logs a where a.company_id = c.id)
    )
  from companies c
  left join lead_manager lm on lm.company_id = c.id
  where c.deleted_at is null
  order by c.name;
$$;

revoke all on function company_adoption_metrics(integer) from anon, authenticated;
