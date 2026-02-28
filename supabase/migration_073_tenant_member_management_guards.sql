-- Migration 073: Tenant member management safeguards
--
-- Goals:
-- 1) Let tenant admins read and update member profile rows for members in their tenant.
-- 2) Prevent deleting or demoting the last active admin membership in a tenant.

create or replace function public.can_manage_tenant_member_profile(p_member_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.members actor
    join public.tenant_members actor_tm
      on actor_tm.member_id = actor.id
     and actor_tm.status = 'active'
     and actor_tm.role in ('admin', 'superadmin')
    join public.tenant_members target_tm
      on target_tm.member_id = p_member_id
     and target_tm.tenant_id = actor_tm.tenant_id
    where actor.auth_id = auth.uid()
  );
$$;

grant execute on function public.can_manage_tenant_member_profile(integer) to authenticated;

drop policy if exists "Tenant admins view tenant member profiles" on public.members;
create policy "Tenant admins view tenant member profiles"
on public.members
for select
to authenticated
using (public.can_manage_tenant_member_profile(id));

drop policy if exists "Tenant admins update tenant member profiles" on public.members;
create policy "Tenant admins update tenant member profiles"
on public.members
for update
to authenticated
using (public.can_manage_tenant_member_profile(id))
with check (public.can_manage_tenant_member_profile(id));

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

drop trigger if exists trg_guard_last_active_tenant_admin on public.tenant_members;
create trigger trg_guard_last_active_tenant_admin
before update or delete on public.tenant_members
for each row
execute function public.guard_last_active_tenant_admin();
