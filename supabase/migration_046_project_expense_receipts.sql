-- Migration 046: Add receipt metadata and payment references to project expenses

alter table public.project_expenses
  add column if not exists payment_reference text,
  add column if not exists receipt_file_path text,
  add column if not exists receipt_file_url text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_file_size_bytes bigint,
  add column if not exists receipt_uploaded_at timestamptz;

alter table public.project_expenses
  drop constraint if exists project_expenses_receipt_file_size_nonnegative_chk;

alter table public.project_expenses
  add constraint project_expenses_receipt_file_size_nonnegative_chk
  check (receipt_file_size_bytes is null or receipt_file_size_bytes >= 0);

create index if not exists idx_project_expenses_project_receipt_uploaded
  on public.project_expenses(project_id, receipt_uploaded_at desc);
