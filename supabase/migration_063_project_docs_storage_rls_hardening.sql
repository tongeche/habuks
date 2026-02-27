-- Migration 063: Harden storage access for project-docs bucket
--
-- Goals:
-- 1) Validate storage paths against tenant + project ownership.
-- 2) Separate read and write authorization.
-- 3) Restrict writes to users who can manage the target project.

create or replace function public.can_access_project_docs_tenant_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  with parsed as (
    select
      split_part(coalesce(object_name, ''), '/', 1) as seg1,
      split_part(coalesce(object_name, ''), '/', 2) as tenant_segment,
      split_part(coalesce(object_name, ''), '/', 3) as seg3,
      split_part(coalesce(object_name, ''), '/', 4) as project_segment
  ),
  normalized as (
    select
      seg1,
      tenant_segment,
      seg3,
      case
        when project_segment ~ '^[0-9]+$' then project_segment::integer
        else null
      end as project_id
    from parsed
  )
  select exists (
    select 1
    from normalized n
    join public.iga_projects p
      on p.id = n.project_id
    where n.seg1 = 'tenants'
      and n.seg3 = 'projects'
      and n.tenant_segment <> ''
      and p.tenant_id::text = n.tenant_segment
      and public.can_access_iga_project(p.id)
  );
$$;

create or replace function public.can_manage_project_docs_tenant_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  with parsed as (
    select
      split_part(coalesce(object_name, ''), '/', 1) as seg1,
      split_part(coalesce(object_name, ''), '/', 2) as tenant_segment,
      split_part(coalesce(object_name, ''), '/', 3) as seg3,
      split_part(coalesce(object_name, ''), '/', 4) as project_segment
  ),
  normalized as (
    select
      seg1,
      tenant_segment,
      seg3,
      case
        when project_segment ~ '^[0-9]+$' then project_segment::integer
        else null
      end as project_id
    from parsed
  )
  select exists (
    select 1
    from normalized n
    join public.iga_projects p
      on p.id = n.project_id
    where n.seg1 = 'tenants'
      and n.seg3 = 'projects'
      and n.tenant_segment <> ''
      and p.tenant_id::text = n.tenant_segment
      and public.can_manage_iga_project(p.id)
  );
$$;

grant execute on function public.can_access_project_docs_tenant_path(text) to authenticated;
grant execute on function public.can_manage_project_docs_tenant_path(text) to authenticated;

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
  and public.can_manage_project_docs_tenant_path(name)
);

drop policy if exists "Authenticated update project docs tenant paths" on storage.objects;
create policy "Authenticated update project docs tenant paths"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-docs'
  and public.can_manage_project_docs_tenant_path(name)
)
with check (
  bucket_id = 'project-docs'
  and public.can_manage_project_docs_tenant_path(name)
);

drop policy if exists "Authenticated delete project docs tenant paths" on storage.objects;
create policy "Authenticated delete project docs tenant paths"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-docs'
  and public.can_manage_project_docs_tenant_path(name)
);

