-- Corrige el borrado en cascada de empresas y usuarios ante la tabla task_folders.
--
-- Las carpetas de tareas se añadieron el 22/06/2026, después de escribirse
-- delete_company_cascade (10/06) y delete_user_cascade (15/06). Ninguna de las dos
-- funciones las conoce, y `task_folders.created_by` referencia `users(id)` sin
-- acción de borrado, por lo que la restricción es RESTRICT.
--
-- Efecto: `delete from users` falla con violación de clave foránea en cuanto esa
-- persona haya creado una carpeta, y como las funciones son transaccionales, la
-- eliminación completa de la empresa o del usuario se revierte. En la interfaz se
-- ve como un error genérico al intentar eliminar una empresa.
--
-- Se corrige en dos frentes: la restricción pasa a `on delete set null` (una
-- carpeta sobrevive a quien la creó, igual que ya ocurre con `users.created_by`)
-- y ambas funciones borran explícitamente las carpetas que correspondan.

alter table public.task_folders
  alter column created_by drop not null;

alter table public.task_folders
  drop constraint if exists task_folders_created_by_fkey;

alter table public.task_folders
  add constraint task_folders_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;

-- ── Empresa ──────────────────────────────────────────────────────────────────
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

  -- `companies.drive_owner_user_id` apunta a un usuario de esta misma empresa y
  -- tampoco tiene acción de borrado: hay que soltarlo antes de eliminarlos.
  update companies
  set drive_owner_user_id = null
  where id = target_company_id;

  delete from users where company_id = target_company_id;
  delete from companies where id = target_company_id;

  return true;
end;
$$;

revoke all on function delete_company_cascade(uuid) from anon, authenticated;

-- ── Usuario ──────────────────────────────────────────────────────────────────
-- Aquí la empresa sigue existiendo, así que las carpetas no se borran: solo se
-- desvinculan de quien las creó, para no perder la organización del equipo.
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

  update users set created_by = null where created_by = target_user_id;

  -- Si quien se elimina era quien conectó Google Drive, la conexión de la empresa
  -- queda inservible: su refresh token desaparece con la cuenta. Se limpia entera
  -- para que otro/a gestor/a la vuelva a configurar desde su perfil.
  update companies
  set drive_owner_user_id = null,
      drive_folder_id = null,
      drive_folder_url = null,
      drive_connected_at = null
  where drive_owner_user_id = target_user_id;

  delete from password_reset_tokens where user_id = target_user_id;
  delete from users where id = target_user_id;

  return true;
end;
$$;

revoke all on function delete_user_cascade(uuid) from anon, authenticated;
