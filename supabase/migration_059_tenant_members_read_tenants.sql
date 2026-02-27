-- Migration 059: Allow active tenant members to read their tenant row.
-- Prevents invited non-admin members from being routed to workspace creation
-- when tenant is private (is_public = false).

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.tenant_members tm
    join public.members m on m.id = tm.member_id
    where tm.tenant_id = p_tenant_id
      and tm.status = 'active'
      and m.auth_id = auth.uid()
  );
$$;

grant execute on function public.is_tenant_member(uuid) to authenticated;

drop policy if exists "Tenant members read tenants" on public.tenants;
create policy "Tenant members read tenants"
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id));
