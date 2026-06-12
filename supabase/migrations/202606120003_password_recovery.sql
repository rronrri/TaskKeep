alter table users add column if not exists must_change_password boolean not null default false;

update users
set deleted_at = null
where is_active = false
  and deleted_at is not null;

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx on password_reset_tokens(user_id, created_at desc);
alter table password_reset_tokens enable row level security;
revoke all on password_reset_tokens from anon, authenticated;
