create table if not exists public.task_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_id uuid references public.task_folders(id) on delete cascade,
  created_by uuid not null references public.users(id),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists task_folders_unique_name_idx
  on public.task_folders(company_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create index if not exists task_folders_company_parent_idx on public.task_folders(company_id, parent_id);

alter table public.tasks
  add column if not exists folder_id uuid references public.task_folders(id) on delete set null;

create index if not exists tasks_folder_idx on public.tasks(folder_id) where deleted_at is null;

alter table public.task_folders enable row level security;
