-- Limitación de intentos compartida entre instancias.
--
-- El contador vivía en un Map en memoria del proceso. En un despliegue
-- serverless (Vercel) cada petición puede atenderse en una instancia distinta y
-- las instancias se reciclan, así que el contador estaba casi siempre vacío y el
-- límite del login no se aplicaba de forma efectiva. Se mueve a la base de datos,
-- que es el único estado compartido por todas las instancias.
--
-- Dos mecanismos complementarios:
--   1. consume_rate_limit()  — ventana fija por clave (IP + endpoint).
--   2. register_failed_login()/clear_failed_logins() — bloqueo por cuenta, que es
--      lo que realmente frena el relleno de credenciales desde muchas IPs.

create table if not exists rate_limit_hits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_hits_window_start_idx
  on rate_limit_hits (window_start);

-- Registra un intento y devuelve true si aún está dentro del límite.
-- La ventana es fija: se alinea al múltiplo de window_seconds correspondiente.
create or replace function consume_rate_limit(
  bucket text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_hits integer;
begin
  current_window := to_timestamp(
    floor(extract(epoch from now()) / window_seconds) * window_seconds
  );

  insert into rate_limit_hits (bucket_key, window_start, hits)
  values (bucket, current_window, 1)
  on conflict (bucket_key, window_start)
    do update set hits = rate_limit_hits.hits + 1
  returning hits into current_hits;

  -- Purga oportunista: mantiene la tabla pequeña sin necesidad de un cron.
  if random() < 0.01 then
    delete from rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return current_hits <= max_hits;
end;
$$;

revoke all on function consume_rate_limit(text, integer, integer) from anon, authenticated;

-- Bloqueo por cuenta tras varios intentos fallidos consecutivos.
alter table users add column if not exists failed_login_attempts integer not null default 0;
alter table users add column if not exists locked_until timestamptz;

-- Suma un intento fallido y bloquea la cuenta al llegar al umbral.
-- Devuelve el instante hasta el que queda bloqueada, o null si sigue disponible.
create or replace function register_failed_login(
  target_email text,
  max_attempts integer default 8,
  lock_minutes integer default 15
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  locked timestamptz;
begin
  update users
  set failed_login_attempts = failed_login_attempts + 1,
      locked_until = case
        when failed_login_attempts + 1 >= max_attempts
          then now() + make_interval(mins => lock_minutes)
        else locked_until
      end
  where lower(email) = lower(target_email)
    and deleted_at is null
  returning locked_until into locked;

  return locked;
end;
$$;

revoke all on function register_failed_login(text, integer, integer) from anon, authenticated;

-- Reinicia el contador tras un inicio de sesión correcto.
create or replace function clear_failed_logins(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update users
  set failed_login_attempts = 0,
      locked_until = null
  where id = target_user_id
    and (failed_login_attempts <> 0 or locked_until is not null);
end;
$$;

revoke all on function clear_failed_logins(uuid) from anon, authenticated;
