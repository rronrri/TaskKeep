alter table task_files
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_by uuid references users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_comment text;

create index if not exists task_files_approval_idx
  on task_files(task_id, approval_status)
  where deleted_at is null;
