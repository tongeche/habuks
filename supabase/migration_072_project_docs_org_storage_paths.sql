-- Migration 072: Allow organization document paths inside the project-docs bucket
--
-- The bucket already stores tenant-scoped files under tenants/<tenant-id>/...
-- Existing RLS helpers only recognized project paths:
--   tenants/<tenant-id>/projects/<project-id>/...
-- Organization document uploads use:
--   tenants/<tenant-id>/organization/documents/...
-- Extend the storage path helpers so minutes PDFs and other organization
-- documents can be uploaded and read with organization-level access rules.

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
      split_part(coalesce(object_name, ''), '/', 4) as seg4
  ),
  normalized as (
    select
      seg1,
      tenant_segment,
      seg3,
      seg4,
      case
        when tenant_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then tenant_segment::uuid
        else null
      end as tenant_id,
      case
        when seg4 ~ '^[0-9]+$' then seg4::integer
        else null
      end as project_id
    from parsed
  )
  select exists (
    select 1
    from normalized n
    where n.seg1 = 'tenants'
      and n.tenant_id is not null
      and (
        (
          n.seg3 = 'projects'
          and exists (
            select 1
            from public.iga_projects p
            where p.id = n.project_id
              and p.tenant_id = n.tenant_id
              and public.can_access_iga_project(p.id)
          )
        )
        or (
          n.seg3 = 'organization'
          and n.seg4 = 'documents'
          and public.can_access_organization_activity(n.tenant_id)
        )
      )
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
      split_part(coalesce(object_name, ''), '/', 4) as seg4
  ),
  normalized as (
    select
      seg1,
      tenant_segment,
      seg3,
      seg4,
      case
        when tenant_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then tenant_segment::uuid
        else null
      end as tenant_id,
      case
        when seg4 ~ '^[0-9]+$' then seg4::integer
        else null
      end as project_id
    from parsed
  )
  select exists (
    select 1
    from normalized n
    where n.seg1 = 'tenants'
      and n.tenant_id is not null
      and (
        (
          n.seg3 = 'projects'
          and exists (
            select 1
            from public.iga_projects p
            where p.id = n.project_id
              and p.tenant_id = n.tenant_id
              and public.can_manage_iga_project(p.id)
          )
        )
        or (
          n.seg3 = 'organization'
          and n.seg4 = 'documents'
          and public.can_manage_organization_activity(n.tenant_id)
        )
      )
  );
$$;

grant execute on function public.can_access_project_docs_tenant_path(text) to authenticated;
grant execute on function public.can_manage_project_docs_tenant_path(text) to authenticated;
