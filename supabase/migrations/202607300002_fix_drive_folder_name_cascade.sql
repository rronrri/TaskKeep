-- delete_user_cascade limpiaba drive_folder_id/drive_owner_user_id/etc al borrar
-- a quien conecto Drive, pero se escribio antes de que existiera
-- companies.drive_folder_name: dejaba ese nombre huerfano en la empresa.
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
      drive_folder_name = null,
      drive_connected_at = null
  where drive_owner_user_id = target_user_id;

  delete from password_reset_tokens where user_id = target_user_id;
  delete from users where id = target_user_id;

  return true;
end;
$$;

revoke all on function delete_user_cascade(uuid) from anon, authenticated;

-- Limpieza puntual del dato huerfano ya existente (empresa sin Drive conectado
-- pero con un nombre de carpeta viejo colgando).
update companies
set drive_folder_name = null
where drive_folder_id is null and drive_owner_user_id is null and drive_folder_name is not null;
