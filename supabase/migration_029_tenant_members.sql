-- Migration 029: Tenant members (multi-tenant memberships)

create table if not exists tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id integer not null references members(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, member_id)
);

create index if not exists tenant_members_tenant_idx on tenant_members (tenant_id);
create index if not exists tenant_members_member_idx on tenant_members (member_id);

alter table tenant_members enable row level security;

-- Members can view their own tenant memberships
create policy "Members view own tenant memberships"
on tenant_members
for select
to authenticated
using (
  member_id = (select id from members where auth_id = auth.uid())
);

-- Bootstrap: allow the first admin to claim a tenant workspace
create policy "Bootstrap tenant admin"
on tenant_members
for insert
to authenticated
with check (
  member_id = (select id from members where auth_id = auth.uid())
  and role = 'admin'
  and not exists (
    select 1 from tenant_members tm
    where tm.tenant_id = tenant_id
  )
);
