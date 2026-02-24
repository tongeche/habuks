-- Migration 036: Allow tenant owner (contact_email) to self-join as admin

create policy "Tenant owner can self-join"
on tenant_members
for insert
to authenticated
with check (
  role = 'admin'
  and member_id = (select id from members where auth_id = auth.uid())
  and exists (
    select 1
    from tenants t
    where t.id = tenant_id
      and lower(t.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
