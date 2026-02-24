-- Migration 035: Allow tenant admins to manage their own tenant config

create policy "Tenant admins read tenants"
on tenants
for select
to authenticated
using (
  exists (
    select 1
    from tenant_members tm
    join members m on m.id = tm.member_id
    where tm.tenant_id = tenants.id
      and tm.role in ('admin', 'superadmin')
      and m.auth_id = auth.uid()
  )
);

create policy "Tenant admins update tenants"
on tenants
for update
to authenticated
using (
  exists (
    select 1
    from tenant_members tm
    join members m on m.id = tm.member_id
    where tm.tenant_id = tenants.id
      and tm.role in ('admin', 'superadmin')
      and m.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from tenant_members tm
    join members m on m.id = tm.member_id
    where tm.tenant_id = tenants.id
      and tm.role in ('admin', 'superadmin')
      and m.auth_id = auth.uid()
  )
);
