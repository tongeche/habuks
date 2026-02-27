-- Migration 057: Invite-scoped project access for magic-link onboarding
-- Adds project scope metadata to invites and provides an RPC for assignment
-- during registration.

alter table public.magic_link_invites
  add column if not exists project_access_scope text,
  add column if not exists project_ids integer[];

update public.magic_link_invites
set project_access_scope = 'none'
where project_access_scope is null
   or lower(project_access_scope) not in ('none', 'selected', 'all');

alter table public.magic_link_invites
  alter column project_access_scope set default 'none';

alter table public.magic_link_invites
  alter column project_access_scope set not null;

update public.magic_link_invites
set project_ids = '{}'::integer[]
where project_ids is null;

alter table public.magic_link_invites
  alter column project_ids set default '{}'::integer[];

alter table public.magic_link_invites
  alter column project_ids set not null;

create index if not exists idx_magic_link_invites_project_scope
  on public.magic_link_invites(project_access_scope);

create index if not exists idx_magic_link_invites_project_ids
  on public.magic_link_invites using gin(project_ids);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'magic_link_invites_project_scope_check'
      and conrelid = 'public.magic_link_invites'::regclass
  ) then
    alter table public.magic_link_invites
      add constraint magic_link_invites_project_scope_check
      check (project_access_scope in ('none', 'selected', 'all'));
  end if;
end;
$$;

drop function if exists public.verify_magic_link_invite(text);

create function public.verify_magic_link_invite(p_invite_number text)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role varchar,
  invite_number varchar,
  status varchar,
  created_at timestamptz,
  expires_at timestamptz,
  project_access_scope text,
  project_ids integer[]
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select
    mli.id,
    mli.tenant_id,
    mli.email,
    mli.phone_number,
    mli.role,
    mli.invite_number,
    mli.status,
    mli.created_at,
    mli.expires_at,
    coalesce(mli.project_access_scope, 'none') as project_access_scope,
    coalesce(mli.project_ids, '{}'::integer[]) as project_ids
  from public.magic_link_invites mli
  where mli.invite_number = p_invite_number
    and lower(coalesce(mli.status, 'pending')) in ('pending', 'sent')
    and (mli.expires_at is null or mli.expires_at > now())
  order by mli.created_at desc
  limit 1;
end;
$function$;

grant execute on function public.verify_magic_link_invite(text) to authenticated, anon;

create or replace function public.apply_magic_link_invite_project_access(
  p_invite_id uuid,
  p_member_id integer
)
returns table (
  project_id integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  invite_row public.magic_link_invites%rowtype;
  member_email text;
  normalized_scope text;
begin
  if p_invite_id is null or p_member_id is null then
    return;
  end if;

  select *
  into invite_row
  from public.magic_link_invites
  where id = p_invite_id
  limit 1;

  if invite_row.id is null then
    return;
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at <= now() then
    return;
  end if;

  if lower(coalesce(invite_row.status, 'pending')) in ('revoked', 'expired') then
    return;
  end if;

  select lower(m.email)
  into member_email
  from public.members m
  where m.id = p_member_id;

  if member_email is null then
    return;
  end if;

  if invite_row.email is not null and lower(invite_row.email) <> member_email then
    return;
  end if;

  normalized_scope := lower(coalesce(invite_row.project_access_scope, 'none'));

  if normalized_scope not in ('selected', 'all') then
    return;
  end if;

  if invite_row.tenant_id is null then
    return;
  end if;

  if normalized_scope = 'all' then
    return query
    with source_projects as (
      select p.id as project_id
      from public.iga_projects p
      where p.tenant_id = invite_row.tenant_id
    ), inserted as (
      insert into public.iga_committee_members (project_id, member_id, role, term_start, tenant_id)
      select
        s.project_id,
        p_member_id,
        coalesce(nullif(trim(invite_row.role), ''), 'member'),
        current_date,
        invite_row.tenant_id
      from source_projects s
      where not exists (
        select 1
        from public.iga_committee_members existing
        where existing.project_id = s.project_id
          and existing.member_id = p_member_id
      )
      returning project_id
    )
    select inserted.project_id
    from inserted;

    return;
  end if;

  return query
  with requested_projects as (
    select distinct unnest(coalesce(invite_row.project_ids, '{}'::integer[])) as project_id
  ), valid_projects as (
    select p.id as project_id
    from requested_projects requested
    join public.iga_projects p on p.id = requested.project_id
    where p.tenant_id = invite_row.tenant_id
  ), inserted as (
    insert into public.iga_committee_members (project_id, member_id, role, term_start, tenant_id)
    select
      v.project_id,
      p_member_id,
      coalesce(nullif(trim(invite_row.role), ''), 'member'),
      current_date,
      invite_row.tenant_id
    from valid_projects v
    where not exists (
      select 1
      from public.iga_committee_members existing
      where existing.project_id = v.project_id
        and existing.member_id = p_member_id
    )
    returning project_id
  )
  select inserted.project_id
  from inserted;
end;
$function$;

grant execute on function public.apply_magic_link_invite_project_access(uuid, integer) to authenticated, anon;
