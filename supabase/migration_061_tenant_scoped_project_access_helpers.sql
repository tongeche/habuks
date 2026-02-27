-- Migration 061: Tenant-scoped project access helpers
--
-- Goals:
-- 1) Align DB authorization with tenant roles used by dashboard UI.
-- 2) Keep members read-capable but restrict project mutations to:
--    - tenant admins / tenant project managers
--    - project leaders
--    - platform admins/superadmins
-- 3) Require active tenant membership for tenant-admin checks.

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.members m
      on m.id = tm.member_id
    where tm.tenant_id = p_tenant_id
      and tm.status = 'active'
      and tm.role in ('admin', 'superadmin')
      and m.auth_id = auth.uid()
  );
$$;

grant execute on function public.is_tenant_admin(uuid) to authenticated;

create or replace function public.can_access_iga_project(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m
      on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        m.role in ('admin', 'superadmin')
        or p.project_leader = m.id
        or tm.id is not null
        or exists (
          select 1
          from public.iga_committee_members icm
          where icm.project_id = p.id
            and icm.member_id = m.id
        )
      )
  );
$$;

create or replace function public.can_manage_iga_project(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m
      on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        m.role in ('admin', 'superadmin')
        or p.project_leader = m.id
        or tm.role in ('admin', 'superadmin', 'project_manager')
      )
  );
$$;

grant execute on function public.can_access_iga_project(integer) to authenticated;
grant execute on function public.can_manage_iga_project(integer) to authenticated;

