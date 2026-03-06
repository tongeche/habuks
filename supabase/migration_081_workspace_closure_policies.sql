-- Migration 081: Workspace closure policies and guard relaxation for tenant cascade deletes

drop policy if exists "Tenant admins delete tenants" on public.tenants;
create policy "Tenant admins delete tenants"
on public.tenants
for delete
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    join public.members m
      on m.id = tm.member_id
    where tm.tenant_id = tenants.id
      and tm.status = 'active'
      and tm.role in ('admin', 'superadmin')
      and m.auth_id = auth.uid()
  )
);

create or replace function public.guard_last_active_tenant_admin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  remaining_admins integer := 0;
  affected_tenant_id uuid;
begin
  if tg_op = 'DELETE' then
    -- Allow tenant_members cascade deletion when the parent tenant is being deleted.
    if not exists (
      select 1
      from public.tenants t
      where t.id = old.tenant_id
    ) then
      return old;
    end if;

    affected_tenant_id := old.tenant_id;

    if coalesce(old.status, 'active') <> 'active' or coalesce(old.role, 'member') not in ('admin', 'superadmin') then
      return old;
    end if;

    select count(*)
      into remaining_admins
    from public.tenant_members tm
    where tm.tenant_id = old.tenant_id
      and tm.id <> old.id
      and tm.status = 'active'
      and tm.role in ('admin', 'superadmin');

    if remaining_admins = 0 then
      raise exception 'Each workspace must retain at least one active admin.';
    end if;

    return old;
  end if;

  affected_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if coalesce(old.status, 'active') = 'active'
     and coalesce(old.role, 'member') in ('admin', 'superadmin')
     and (
       coalesce(new.status, 'active') <> 'active'
       or coalesce(new.role, 'member') not in ('admin', 'superadmin')
     ) then
    select count(*)
      into remaining_admins
    from public.tenant_members tm
    where tm.tenant_id = affected_tenant_id
      and tm.id <> old.id
      and tm.status = 'active'
      and tm.role in ('admin', 'superadmin');

    if remaining_admins = 0 then
      raise exception 'Each workspace must retain at least one active admin.';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "Members can delete own profile" on public.members;
create policy "Members can delete own profile"
on public.members
for delete
to authenticated
using (auth.uid() = auth_id);
