-- Migration 027: Tenants table for multi-tenant SaaS onboarding

create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  contact_email text,
  contact_phone text,
  location text,
  logo_url text,
  site_data jsonb,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tenants_slug_idx on tenants (slug);

alter table tenants enable row level security;

-- Public read for published tenants
create policy "Public tenants read"
on tenants
for select
to anon, authenticated
using (is_public = true);

-- Allow public tenant signups (basic insert only)
create policy "Public tenants insert"
on tenants
for insert
to anon, authenticated
with check (
  name is not null
  and slug is not null
  and coalesce(is_public, true) = true
);

-- Admins can manage tenants
create policy "Admins manage tenants"
on tenants
for all
to authenticated
using (
  exists (
    select 1 from members
    where members.auth_id = auth.uid()
    and members.role in ('admin', 'superadmin')
  )
)
with check (
  exists (
    select 1 from members
    where members.auth_id = auth.uid()
    and members.role in ('admin', 'superadmin')
  )
);
