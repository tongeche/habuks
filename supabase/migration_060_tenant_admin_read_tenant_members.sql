-- Migration 060: Let tenant admins read all memberships in their tenant.
-- Without this, admin users only see their own row from tenant_members,
-- which makes Organization > Members look like it has one member only.

drop policy if exists "Tenant admins read tenant memberships" on public.tenant_members;
create policy "Tenant admins read tenant memberships"
on public.tenant_members
for select
to authenticated
using (public.is_tenant_admin(tenant_id));

