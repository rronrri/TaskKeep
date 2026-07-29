-- Métricas de adopción por empresa para el panel de administración.
--
-- Responde a "¿quién está usando de verdad la herramienta y su equipo la sigue?".
-- Hasta ahora sólo se podía contar cuántas cuentas existían, no si se usaban.
--
-- Se calcula en SQL y no en la aplicación: son seis agregaciones por empresa y
-- resolverlas con consultas separadas obligaría a N+1 llamadas desde el servidor.

-- Sin esto no se puede distinguir una cuenta activa de una abandonada.
alter table users
  add column if not exists last_login_at timestamptz;

create index if not exists users_last_login_idx
  on users (company_id, last_login_at desc)
  where deleted_at is null;

-- Índices de apoyo para las agregaciones por período.
create index if not exists tasks_company_created_idx
  on tasks (company_id, created_at desc)
  where deleted_at is null;

create index if not exists audit_logs_company_created_idx
  on audit_logs (company_id, created_at desc);

/**
 * Una fila por empresa activa, con el pulso de uso del período indicado.
 *
 * `collaborators_active` cuenta quienes accedieron dentro del período, no quienes
 * existen: es la diferencia entre "creó cuentas para su equipo" y "su equipo la usa".
 */
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
  -- Gestor/a de referencia: el de acceso más reciente, o el más antiguo si
  -- ninguno ha entrado nunca.
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
    (c.drive_folder_id is not null and c.drive_owner_user_id is not null),
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
