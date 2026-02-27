-- Migration 068: Project-level invite RPCs for scoped invite management
-- Adds secure helper RPCs so project admins/managers/coordinators can
-- list and create project-scoped invites without broad table access.

create or replace function public.can_manage_project_invites(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m
      on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        lower(coalesce(m.role, '')) in ('admin', 'superadmin')
        or p.project_leader = m.id
        or lower(coalesce(tm.role, '')) in ('admin', 'superadmin', 'project_manager', 'coordinator')
        or exists (
          select 1
          from public.iga_committee_members icm
          where icm.project_id = p.id
            and icm.member_id = m.id
            and lower(coalesce(icm.role, '')) in ('project_manager', 'coordinator')
        )
      )
  );
$$;

grant execute on function public.can_manage_project_invites(integer) to authenticated;

create or replace function public.get_project_magic_link_invites(p_project_id integer)
returns table (
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
set search_path = public
set row_security = off
as $$
  with requested_project as (
    select p.id, p.tenant_id
    from public.iga_projects p
    where p.id = p_project_id
    limit 1
  ), permission_check as (
    select public.can_manage_project_invites(p_project_id) as allowed
  )
  select
    mli.id,
    mli.tenant_id,
    mli.email,
    mli.phone_number,
    mli.role::text,
    mli.invite_number::text,
    mli.status::text,
    mli.created_at,
    mli.expires_at,
    coalesce(mli.project_access_scope, 'none')::text,
    coalesce(mli.project_ids, '{}'::integer[]) as project_ids,
    mli.created_by,
    mli.used_at,
    mli.used_by,
    mli.notes
  from public.magic_link_invites mli
  join requested_project rp
    on rp.tenant_id = mli.tenant_id
  cross join permission_check pc
  where pc.allowed
    and (
      lower(coalesce(mli.project_access_scope, 'none')) = 'all'
      or (
        lower(coalesce(mli.project_access_scope, 'none')) = 'selected'
        and rp.id = any(coalesce(mli.project_ids, '{}'::integer[]))
      )
    )
  order by mli.created_at desc;
$$;

grant execute on function public.get_project_magic_link_invites(integer) to authenticated;

create or replace function public.create_project_magic_link_invite(
  p_project_id integer,
  p_email text,
  p_role text default 'member',
  p_phone_number text default null,
  p_notes text default null
)
returns table (
  id uuid,
  invite_number text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  project_row record;
  creator_member_id integer;
  normalized_email text;
  normalized_role text;
  generated_invite_number text;
  attempt_count integer := 0;
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception 'Project id is required.';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.id, p.tenant_id
  into project_row
  from public.iga_projects p
  where p.id = p_project_id
  limit 1;

  if project_row.id is null then
    raise exception 'Project not found.';
  end if;

  if not public.can_manage_project_invites(p_project_id) then
    raise exception 'You do not have permission to invite members for this project.' using errcode = '42501';
  end if;

  select m.id
  into creator_member_id
  from public.members m
  where m.auth_id = auth.uid()
  limit 1;

  normalized_email := lower(btrim(coalesce(p_email, '')));
  if normalized_email = '' then
    raise exception 'Invite email is required.';
  end if;

  normalized_role := lower(btrim(coalesce(p_role, 'member')));
  if normalized_role = '' then
    normalized_role := 'member';
  end if;

  loop
    attempt_count := attempt_count + 1;
    generated_invite_number := public.generate_invite_number();

    begin
      return query
      insert into public.magic_link_invites (
        tenant_id,
        email,
        phone_number,
        role,
        status,
        invite_number,
        created_by,
        expires_at,
        notes,
        project_access_scope,
        project_ids
      )
      values (
        project_row.tenant_id,
        normalized_email,
        nullif(btrim(coalesce(p_phone_number, '')), ''),
        normalized_role,
        'pending',
        generated_invite_number,
        creator_member_id,
        now() + interval '7 days',
        nullif(btrim(coalesce(p_notes, '')), ''),
        'selected',
        array[p_project_id]::integer[]
      )
      returning magic_link_invites.id, magic_link_invites.invite_number::text;

      return;
    exception
      when unique_violation then
        if attempt_count >= 8 then
          raise exception 'Failed to generate a unique invite number.';
        end if;
    end;
  end loop;
end;
$function$;

grant execute on function public.create_project_magic_link_invite(integer, text, text, text, text)
  to authenticated;
