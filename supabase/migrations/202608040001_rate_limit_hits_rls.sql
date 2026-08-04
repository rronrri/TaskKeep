-- rate_limit_hits solo se toca desde consume_rate_limit() (security definer),
-- que corre con permisos de owner y por tanto ignora RLS. No hace falta
-- ninguna policy: basta con activar RLS para que quede denegado por defecto
-- a cualquier acceso directo vía PostgREST (anon/authenticated).
alter table rate_limit_hits enable row level security;
revoke all on rate_limit_hits from anon, authenticated;
