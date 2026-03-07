-- Migration 086: UUID support layer for IGA project identifiers
-- Goal:
-- 1) Keep legacy integer project IDs operational.
-- 2) Add UUID identity to iga_projects.
-- 3) Provide UUID function overloads so app/services can start using UUID refs.

create extension if not exists pgcrypto;

-- Add UUID identity column on projects (non-breaking alongside legacy int id).
alter table public.iga_projects
  add column if not exists project_uuid uuid;

update public.iga_projects
set project_uuid = gen_random_uuid()
where project_uuid is null;

alter table public.iga_projects
  alter column project_uuid set default gen_random_uuid();

alter table public.iga_projects
  alter column project_uuid set not null;

create unique index if not exists iga_projects_project_uuid_uq
  on public.iga_projects (project_uuid);

-- Lookup helpers used by UUID overload wrappers.
create or replace function public.resolve_iga_project_legacy_id(p_project_uuid uuid)
returns integer
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select p.id
  from public.iga_projects p
  where p.project_uuid = p_project_uuid
  limit 1;
$$;

create or replace function public.resolve_iga_project_uuid(p_project_id integer)
returns uuid
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select p.project_uuid
  from public.iga_projects p
  where p.id = p_project_id
  limit 1;
$$;

grant execute on function public.resolve_iga_project_legacy_id(uuid) to authenticated, anon;
grant execute on function public.resolve_iga_project_uuid(integer) to authenticated, anon;

-- UUID overloads for access helpers.
create or replace function public.can_access_iga_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select case
    when p_project_id is null then false
    else public.can_access_iga_project(public.resolve_iga_project_legacy_id(p_project_id))
  end;
$$;

create or replace function public.can_manage_iga_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select case
    when p_project_id is null then false
    else public.can_manage_iga_project(public.resolve_iga_project_legacy_id(p_project_id))
  end;
$$;

create or replace function public.can_admin_access_iga_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select case
    when p_project_id is null then false
    else public.can_admin_access_iga_project(public.resolve_iga_project_legacy_id(p_project_id))
  end;
$$;

create or replace function public.can_manage_project_invites(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select case
    when p_project_id is null then false
    else public.can_manage_project_invites(public.resolve_iga_project_legacy_id(p_project_id))
  end;
$$;

grant execute on function public.can_access_iga_project(uuid) to authenticated, anon;
grant execute on function public.can_manage_iga_project(uuid) to authenticated, anon;
grant execute on function public.can_admin_access_iga_project(uuid) to authenticated, anon;
grant execute on function public.can_manage_project_invites(uuid) to authenticated, anon;

-- UUID overloads for project invite RPCs.
create or replace function public.get_project_magic_link_invites(p_project_id uuid)
returns table(
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role text,
  invite_number text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  project_access_scope text,
  project_ids integer[],
  created_by integer,
  used_at timestamptz,
  used_by integer,
  notes text
)
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select *
  from public.get_project_magic_link_invites(public.resolve_iga_project_legacy_id(p_project_id));
$$;

create or replace function public.create_project_magic_link_invite(
  p_project_id uuid,
  p_email text,
  p_role text default 'member',
  p_phone_number text default null,
  p_notes text default null
)
returns table(id uuid, invite_number text)
language sql
security definer
set search_path = 'public'
set row_security = 'off'
as $$
  select *
  from public.create_project_magic_link_invite(
    public.resolve_iga_project_legacy_id(p_project_id),
    p_email,
    p_role,
    p_phone_number,
    p_notes
  );
$$;

grant execute on function public.get_project_magic_link_invites(uuid) to authenticated, anon;
grant execute on function public.create_project_magic_link_invite(uuid, text, text, text, text) to authenticated, anon;

