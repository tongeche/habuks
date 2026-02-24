-- Migration 042: Birds bucket policies with tenant-folder path controls
-- Goal:
-- 1) Restrict birds uploads/updates/deletes to tenant folder paths:
--      tenants/{tenant_id}/...
-- 2) Allow authenticated reads on tenant paths when member belongs to that tenant.
-- 3) Keep temporary legacy read/write compatibility for old jpp/* paths.

-- Helper: checks tenant-folder path access by auth user.
create or replace function public.can_access_birds_tenant_path(object_name text)
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

grant execute on function public.can_access_birds_tenant_path(text) to authenticated;

-- Remove legacy broad birds policies.
drop policy if exists "Public read birds" on storage.objects;
drop policy if exists "Authenticated upload birds" on storage.objects;

-- Idempotent re-create of tenant-aware birds policies.
drop policy if exists "Authenticated read birds tenant paths" on storage.objects;
create policy "Authenticated read birds tenant paths"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'birds'
  and (
    public.can_access_birds_tenant_path(name)
    -- Legacy: keep jpp paths readable by authenticated users until all old media is migrated.
    or split_part(name, '/', 1) = 'jpp'
    -- Legacy fallback for privileged users on any non-tenant path.
    or (
      split_part(name, '/', 1) <> 'tenants'
      and public.is_project_manager()
    )
  )
);

drop policy if exists "Authenticated insert birds tenant paths" on storage.objects;
create policy "Authenticated insert birds tenant paths"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'birds'
  and (
    public.can_access_birds_tenant_path(name)
    -- Legacy compatibility for manager-only jpp uploads.
    or (
      split_part(name, '/', 1) = 'jpp'
      and public.is_project_manager()
    )
  )
);

drop policy if exists "Authenticated update birds tenant paths" on storage.objects;
create policy "Authenticated update birds tenant paths"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'birds'
  and (
    public.can_access_birds_tenant_path(name)
    or (
      split_part(name, '/', 1) = 'jpp'
      and public.is_project_manager()
    )
  )
)
with check (
  bucket_id = 'birds'
  and (
    public.can_access_birds_tenant_path(name)
    or (
      split_part(name, '/', 1) = 'jpp'
      and public.is_project_manager()
    )
  )
);

drop policy if exists "Authenticated delete birds tenant paths" on storage.objects;
create policy "Authenticated delete birds tenant paths"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'birds'
  and (
    public.can_access_birds_tenant_path(name)
    or (
      split_part(name, '/', 1) = 'jpp'
      and public.is_project_manager()
    )
  )
);
