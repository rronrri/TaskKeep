-- Permite invalidar sesiones ya emitidas.
--
-- La sesión es un JWT de 8 horas que lleva incrustados el rol, la empresa y el
-- estado de contraseña temporal, y sólo se comprobaba su firma. Consecuencias:
-- desactivar o eliminar una cuenta no cerraba su sesión, cambiar el rol de alguien
-- no surtía efecto hasta que volviera a entrar, y restablecer la contraseña no
-- expulsaba a quien ya estuviera dentro.
--
-- `session_epoch` actúa como número de generación: se incrusta en el token y se
-- compara contra la base. Al incrementarlo, todos los tokens emitidos antes dejan
-- de ser válidos de inmediato.

alter table users
  add column if not exists session_epoch integer not null default 0;

-- Invalida todas las sesiones abiertas de una persona.
create or replace function bump_session_epoch(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_epoch integer;
begin
  update users
  set session_epoch = session_epoch + 1
  where id = target_user_id
  returning session_epoch into next_epoch;

  return next_epoch;
end;
$$;

revoke all on function bump_session_epoch(uuid) from anon, authenticated;
