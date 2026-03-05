-- Migration 079: Fix ambiguous project_id reference in invite access RPC
-- Postgres can treat RETURNS TABLE output names as variables in PL/pgSQL.
-- Qualify returned project_id values from inserts to avoid ambiguity.

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
      insert into public.iga_committee_members as icm (project_id, member_id, role, term_start, tenant_id)
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
      returning icm.project_id
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
    insert into public.iga_committee_members as icm (project_id, member_id, role, term_start, tenant_id)
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
    returning icm.project_id
  )
  select inserted.project_id
  from inserted;
end;
$function$;

grant execute on function public.apply_magic_link_invite_project_access(uuid, integer) to authenticated, anon;
