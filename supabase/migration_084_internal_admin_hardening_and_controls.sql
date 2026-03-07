-- Migration 084: Internal admin hardening + tenant support controls
--
-- Adds:
-- 1) Guard: only internal super admins can assign global members.role = 'superadmin'
-- 2) Internal-admin RPCs for richer tenant support operations:
--    - Read tenant profile details
--    - Update tenant profile fields
--    - Pause/resume workspace state
--    - Update tenant membership role/status

create or replace function public.guard_superadmin_role_assignments()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_role text;
  actor_email text;
  actor_is_internal_super_admin boolean := false;
  normalized_old_role text := lower(coalesce(old.role, ''));
  normalized_new_role text := lower(
    coalesce(
      case
        when tg_op = 'DELETE' then old.role
        else new.role
      end,
      ''
    )
  );
begin
  request_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  );

  if request_role in ('service_role', 'supabase_admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  actor_email := public.auth_user_email();
  if actor_email is not null then
    select exists (
      select 1
      from public.admin_users au
      where lower(au.email) = actor_email
        and lower(au.role) = 'super_admin'
    )
    into actor_is_internal_super_admin;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if normalized_new_role = 'superadmin' and not actor_is_internal_super_admin then
      raise exception 'Only internal super admins can assign global superadmin role.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if normalized_old_role = 'superadmin' and not actor_is_internal_super_admin then
      raise exception 'Only internal super admins can modify global superadmin role.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_members_guard_superadmin_role on public.members;
create trigger trg_members_guard_superadmin_role
before insert or update on public.members
for each row
execute function public.guard_superadmin_role_assignments();

create or replace function public.admin_get_tenant_profile(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  tenant_name text,
  slug text,
  tagline text,
  location text,
  contact_email text,
  contact_phone text,
  is_public boolean,
  site_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug,
    t.tagline,
    t.location,
    t.contact_email,
    t.contact_phone,
    t.is_public,
    t.site_data,
    t.created_at,
    t.updated_at
  from public.tenants t
  where public.is_internal_admin()
    and t.id = p_tenant_id
  limit 1;
$$;

grant execute on function public.admin_get_tenant_profile(uuid) to authenticated;

create or replace function public.admin_update_tenant_profile(
  p_tenant_id uuid,
  p_name text default null,
  p_tagline text default null,
  p_location text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_is_public boolean default null
)
returns table (
  tenant_id uuid,
  tenant_name text,
  slug text,
  tagline text,
  location text,
  contact_email text,
  contact_phone text,
  is_public boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_name text;
  v_tagline text;
  v_location text;
  v_contact_email text;
  v_contact_phone text;
begin
  if not public.is_internal_admin() then
    raise exception 'Not authorized to manage tenant profiles.';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant ID is required.';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_tagline := nullif(btrim(coalesce(p_tagline, '')), '');
  v_location := nullif(btrim(coalesce(p_location, '')), '');
  v_contact_email := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_contact_phone := nullif(btrim(coalesce(p_contact_phone, '')), '');

  if p_name is not null and v_name is null then
    raise exception 'Workspace name cannot be blank.';
  end if;

  update public.tenants t
  set
    name = case when p_name is null then t.name else v_name end,
    tagline = case when p_tagline is null then t.tagline else v_tagline end,
    location = case when p_location is null then t.location else v_location end,
    contact_email = case when p_contact_email is null then t.contact_email else v_contact_email end,
    contact_phone = case when p_contact_phone is null then t.contact_phone else v_contact_phone end,
    is_public = coalesce(p_is_public, t.is_public),
    updated_at = now()
  where t.id = p_tenant_id;

  return query
  select
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug,
    t.tagline,
    t.location,
    t.contact_email,
    t.contact_phone,
    t.is_public,
    t.updated_at
  from public.tenants t
  where t.id = p_tenant_id
  limit 1;
end;
$$;

grant execute on function public.admin_update_tenant_profile(uuid, text, text, text, text, text, boolean) to authenticated;

create or replace function public.admin_set_tenant_workspace_pause(
  p_tenant_id uuid,
  p_pause boolean,
  p_reason text default null,
  p_pause_days integer default 30
)
returns table (
  tenant_id uuid,
  is_public boolean,
  workspace_closure jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_site_data jsonb;
  v_existing_closure jsonb;
  v_next_site_data jsonb;
  v_previous_is_public boolean;
  v_pause_days integer;
  v_now timestamptz := now();
  v_expires_at timestamptz;
begin
  if not public.is_internal_admin() then
    raise exception 'Not authorized to manage workspace pause state.';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant ID is required.';
  end if;

  select
    coalesce(t.site_data, '{}'::jsonb),
    coalesce(t.site_data -> 'workspace_closure', '{}'::jsonb),
    coalesce(t.is_public, true)
  into v_site_data, v_existing_closure, v_previous_is_public
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant not found.';
  end if;

  if coalesce(p_pause, false) then
    v_pause_days := greatest(1, least(coalesce(p_pause_days, 30), 365));
    v_expires_at := v_now + make_interval(days => v_pause_days);

    v_next_site_data :=
      (v_site_data - 'workspace_closure')
      || jsonb_build_object(
        'workspace_closure',
        jsonb_build_object(
          'status', 'paused',
          'mode', 'admin_support_pause',
          'requested_at', v_now,
          'expires_at', v_expires_at,
          'requested_by_member_id', public.current_actor_member_id(),
          'requested_by_email', public.auth_user_email(),
          'reason', nullif(btrim(coalesce(p_reason, '')), ''),
          'previous_is_public', coalesce(v_previous_is_public, true),
          'export_sections',
          coalesce(
            case
              when jsonb_typeof(v_existing_closure -> 'export_sections') = 'array'
              then v_existing_closure -> 'export_sections'
              else null
            end,
            '["members", "documents", "activities"]'::jsonb
          )
        )
      );

    update public.tenants t
    set
      site_data = v_next_site_data,
      is_public = false,
      updated_at = now()
    where t.id = p_tenant_id;
  else
    v_previous_is_public :=
      case
        when jsonb_typeof(v_existing_closure -> 'previous_is_public') = 'boolean'
        then (v_existing_closure ->> 'previous_is_public')::boolean
        else true
      end;

    v_next_site_data := v_site_data - 'workspace_closure';

    update public.tenants t
    set
      site_data = v_next_site_data,
      is_public = v_previous_is_public,
      updated_at = now()
    where t.id = p_tenant_id;
  end if;

  return query
  select
    t.id as tenant_id,
    t.is_public,
    t.site_data -> 'workspace_closure' as workspace_closure,
    t.updated_at
  from public.tenants t
  where t.id = p_tenant_id
  limit 1;
end;
$$;

grant execute on function public.admin_set_tenant_workspace_pause(uuid, boolean, text, integer) to authenticated;

create or replace function public.admin_update_tenant_membership(
  p_tenant_membership_id uuid,
  p_role text default null,
  p_status text default null
)
returns table (
  tenant_membership_id uuid,
  tenant_id uuid,
  member_id integer,
  tenant_role text,
  tenant_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role text := nullif(lower(btrim(coalesce(p_role, ''))), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  if not public.is_internal_admin() then
    raise exception 'Not authorized to manage tenant members.';
  end if;

  if p_tenant_membership_id is null then
    raise exception 'Tenant membership ID is required.';
  end if;

  if v_role is null and v_status is null then
    raise exception 'At least one membership field must be updated.';
  end if;

  if v_role is not null and v_role not in ('member', 'supervisor', 'project_manager', 'admin', 'superadmin') then
    raise exception 'Unsupported tenant role.';
  end if;

  if v_status is not null and v_status not in ('active', 'pending', 'inactive') then
    raise exception 'Unsupported tenant status.';
  end if;

  update public.tenant_members tm
  set
    role = coalesce(v_role, tm.role),
    status = coalesce(v_status, tm.status),
    updated_at = now()
  where tm.id = p_tenant_membership_id;

  return query
  select
    tm.id as tenant_membership_id,
    tm.tenant_id,
    tm.member_id,
    tm.role as tenant_role,
    tm.status as tenant_status,
    tm.updated_at
  from public.tenant_members tm
  where tm.id = p_tenant_membership_id
  limit 1;
end;
$$;

grant execute on function public.admin_update_tenant_membership(uuid, text, text) to authenticated;

create or replace function public.admin_get_tenant_magic_link_invites(
  p_tenant_id uuid,
  p_limit integer default 200
)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role text,
  status text,
  invite_number text,
  created_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  used_by integer,
  project_access_scope text,
  project_ids integer[],
  notes text
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    mli.id,
    mli.tenant_id,
    mli.email,
    mli.phone_number,
    mli.role::text,
    mli.status::text,
    mli.invite_number::text,
    mli.created_at,
    mli.sent_at,
    mli.expires_at,
    mli.used_at,
    mli.used_by,
    coalesce(mli.project_access_scope, 'none')::text as project_access_scope,
    coalesce(mli.project_ids, '{}'::integer[]) as project_ids,
    mli.notes
  from public.magic_link_invites mli
  where public.is_internal_admin()
    and mli.tenant_id = p_tenant_id
  order by mli.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

grant execute on function public.admin_get_tenant_magic_link_invites(uuid, integer) to authenticated;

create or replace function public.admin_resend_tenant_magic_link_invite(
  p_invite_id uuid,
  p_expires_in_days integer default 7
)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role text,
  status text,
  invite_number text,
  created_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  used_by integer,
  project_access_scope text,
  project_ids integer[],
  notes text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invite public.magic_link_invites%rowtype;
  v_valid_days integer := greatest(1, least(coalesce(p_expires_in_days, 7), 365));
begin
  if not public.is_internal_admin() then
    raise exception 'Not authorized to manage tenant invites.';
  end if;

  if p_invite_id is null then
    raise exception 'Invite ID is required.';
  end if;

  select *
  into v_invite
  from public.magic_link_invites mli
  where mli.id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found.';
  end if;

  if lower(coalesce(v_invite.status, 'pending')) = 'used' then
    raise exception 'Used invites cannot be reissued.';
  end if;

  update public.magic_link_invites mli
  set
    status = 'pending',
    sent_at = now(),
    expires_at = now() + make_interval(days => v_valid_days)
  where mli.id = p_invite_id;

  perform public.log_audit_event(
    v_invite.tenant_id,
    'invite_resent',
    'magic_link_invites',
    p_invite_id::text,
    jsonb_build_object(
      'invite_number', v_invite.invite_number,
      'email', v_invite.email
    )
  );

  return query
  select
    mli.id,
    mli.tenant_id,
    mli.email,
    mli.phone_number,
    mli.role::text,
    mli.status::text,
    mli.invite_number::text,
    mli.created_at,
    mli.sent_at,
    mli.expires_at,
    mli.used_at,
    mli.used_by,
    coalesce(mli.project_access_scope, 'none')::text as project_access_scope,
    coalesce(mli.project_ids, '{}'::integer[]) as project_ids,
    mli.notes
  from public.magic_link_invites mli
  where mli.id = p_invite_id
  limit 1;
end;
$$;

grant execute on function public.admin_resend_tenant_magic_link_invite(uuid, integer) to authenticated;

create or replace function public.admin_cancel_tenant_magic_link_invite(
  p_invite_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role text,
  status text,
  invite_number text,
  created_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  used_by integer,
  project_access_scope text,
  project_ids integer[],
  notes text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invite public.magic_link_invites%rowtype;
begin
  if not public.is_internal_admin() then
    raise exception 'Not authorized to manage tenant invites.';
  end if;

  if p_invite_id is null then
    raise exception 'Invite ID is required.';
  end if;

  select *
  into v_invite
  from public.magic_link_invites mli
  where mli.id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found.';
  end if;

  if lower(coalesce(v_invite.status, 'pending')) = 'used' then
    raise exception 'Used invites cannot be revoked.';
  end if;

  update public.magic_link_invites mli
  set status = 'revoked'
  where mli.id = p_invite_id;

  perform public.log_audit_event(
    v_invite.tenant_id,
    'invite_revoked',
    'magic_link_invites',
    p_invite_id::text,
    jsonb_build_object(
      'invite_number', v_invite.invite_number,
      'email', v_invite.email
    )
  );

  return query
  select
    mli.id,
    mli.tenant_id,
    mli.email,
    mli.phone_number,
    mli.role::text,
    mli.status::text,
    mli.invite_number::text,
    mli.created_at,
    mli.sent_at,
    mli.expires_at,
    mli.used_at,
    mli.used_by,
    coalesce(mli.project_access_scope, 'none')::text as project_access_scope,
    coalesce(mli.project_ids, '{}'::integer[]) as project_ids,
    mli.notes
  from public.magic_link_invites mli
  where mli.id = p_invite_id
  limit 1;
end;
$$;

grant execute on function public.admin_cancel_tenant_magic_link_invite(uuid) to authenticated;
