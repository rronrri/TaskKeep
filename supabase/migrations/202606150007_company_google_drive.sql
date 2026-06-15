alter table public.companies
  add column if not exists drive_folder_url text,
  add column if not exists drive_owner_user_id uuid references public.users(id),
  add column if not exists drive_connected_at timestamptz;

alter table public.task_files
  add column if not exists drive_folder_id text;
