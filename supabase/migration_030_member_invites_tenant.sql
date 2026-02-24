-- Migration 030: Link member invites to tenants

alter table member_invites
  add column if not exists tenant_id uuid references tenants(id) on delete cascade;

create index if not exists member_invites_tenant_idx on member_invites (tenant_id);
