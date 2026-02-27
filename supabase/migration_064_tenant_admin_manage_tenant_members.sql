-- Migration 064: Allow tenant admins to manage tenant memberships
--
-- Goals:
-- 1) Enable tenant admins to add/update/remove tenant members.
-- 2) Keep bootstrap policy intact for first-admin workspace claim.
-- 3) Keep authorization centralized through is_tenant_admin().

alter table public.tenant_members enable row level security;

drop policy if exists "Tenant admins insert tenant memberships" on public.tenant_members;
create policy "Tenant admins insert tenant memberships"
on public.tenant_members
for insert
to authenticated
with check (
  public.is_tenant_admin(tenant_id)
);

drop policy if exists "Tenant admins update tenant memberships" on public.tenant_members;
create policy "Tenant admins update tenant memberships"
on public.tenant_members
for update
to authenticated
using (
  public.is_tenant_admin(tenant_id)
)
with check (
  public.is_tenant_admin(tenant_id)
);

drop policy if exists "Tenant admins delete tenant memberships" on public.tenant_members;
create policy "Tenant admins delete tenant memberships"
on public.tenant_members
for delete
to authenticated
using (
  public.is_tenant_admin(tenant_id)
);

