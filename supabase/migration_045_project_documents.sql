-- Migration 045: Project documents + storage policies
-- Goals:
-- 1) Store documents per project/tenant (DB metadata + storage path).
-- 2) Keep tenant_id synchronized from project_id.
-- 3) Restrict storage access to tenant-folder paths in project-docs bucket.
-- 4) Enforce RLS with existing project access helpers.

create extension if not exists pgcrypto;

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.iga_projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_url text,
  mime_type text not null,
  file_ext text,
  file_size_bytes bigint,
  uploaded_by_member_id integer references public.members(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.project_documents
  drop constraint if exists project_documents_name_not_blank_chk;
alter table public.project_documents
  add constraint project_documents_name_not_blank_chk
  check (length(btrim(name)) > 0);

alter table public.project_documents
  drop constraint if exists project_documents_file_path_not_blank_chk;
alter table public.project_documents
  add constraint project_documents_file_path_not_blank_chk
  check (length(btrim(file_path)) > 0);

alter table public.project_documents
  drop constraint if exists project_documents_mime_type_not_blank_chk;
alter table public.project_documents
  add constraint project_documents_mime_type_not_blank_chk
  check (length(btrim(mime_type)) > 0);

alter table public.project_documents
  drop constraint if exists project_documents_file_size_non_negative_chk;
alter table public.project_documents
  add constraint project_documents_file_size_non_negative_chk
  check (file_size_bytes is null or file_size_bytes >= 0);

create index if not exists project_documents_project_idx
  on public.project_documents (project_id);
create index if not exists project_documents_tenant_idx
  on public.project_documents (tenant_id);
create index if not exists project_documents_project_uploaded_idx
  on public.project_documents (project_id, archived_at, uploaded_at);
create unique index if not exists project_documents_project_path_uq
  on public.project_documents (project_id, file_path);

create or replace function public.set_project_documents_tenant_id()
returns trigger
language plpgsql
as $$
declare
  v_tenant_id uuid;
begin
  if new.project_id is null then
    new.tenant_id := null;
    return new;
  end if;

  select p.tenant_id
    into v_tenant_id
  from public.iga_projects p
  where p.id = new.project_id;

  if not found then
    raise foreign_key_violation using message = format('Invalid project_id: %s', new.project_id);
  end if;

  new.tenant_id := v_tenant_id;
  return new;
end;
$$;

drop trigger if exists trg_project_documents_set_tenant on public.project_documents;
create trigger trg_project_documents_set_tenant
before insert or update on public.project_documents
for each row execute function public.set_project_documents_tenant_id();

create or replace function public.touch_project_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_project_documents_touch_updated_at on public.project_documents;
create trigger trg_project_documents_touch_updated_at
before update on public.project_documents
for each row execute function public.touch_project_documents_updated_at();

alter table public.project_documents enable row level security;

drop policy if exists "Authenticated can view project documents" on public.project_documents;
create policy "Authenticated can view project documents"
on public.project_documents
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage project documents" on public.project_documents;
create policy "Project managers can manage project documents"
on public.project_documents
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

-- Storage bucket for project documents (private bucket + signed URLs).
insert into storage.buckets (id, name, public)
values ('project-docs', 'project-docs', false)
on conflict (id) do update set public = excluded.public;

do $$
begin
  begin
    alter table storage.objects enable row level security;
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

create or replace function public.can_access_project_docs_tenant_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    split_part(coalesce(object_name, ''), '/', 1) = 'tenants'
    and nullif(split_part(object_name, '/', 2), '') is not null
    and exists (
      select 1
      from public.members m
      left join public.tenant_members tm
        on tm.member_id = m.id
       and tm.status = 'active'
      where m.auth_id = auth.uid()
        and (
          m.role in ('admin', 'superadmin', 'project_manager')
          or tm.tenant_id::text = split_part(object_name, '/', 2)
        )
    );
$$;

grant execute on function public.can_access_project_docs_tenant_path(text) to authenticated;

drop policy if exists "Authenticated read project docs tenant paths" on storage.objects;
create policy "Authenticated read project docs tenant paths"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-docs'
  and public.can_access_project_docs_tenant_path(name)
);

drop policy if exists "Authenticated insert project docs tenant paths" on storage.objects;
create policy "Authenticated insert project docs tenant paths"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-docs'
  and public.can_access_project_docs_tenant_path(name)
);

drop policy if exists "Authenticated update project docs tenant paths" on storage.objects;
create policy "Authenticated update project docs tenant paths"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-docs'
  and public.can_access_project_docs_tenant_path(name)
)
with check (
  bucket_id = 'project-docs'
  and public.can_access_project_docs_tenant_path(name)
);

drop policy if exists "Authenticated delete project docs tenant paths" on storage.objects;
create policy "Authenticated delete project docs tenant paths"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-docs'
  and public.can_access_project_docs_tenant_path(name)
);
