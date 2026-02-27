-- Migration 058: Recover tenant membership for invited users
-- Fixes cases where invited members complete signup but tenant_members insert
-- is blocked by RLS policies intended for admin bootstrap flows.
-- Covers both magic_link_invites and legacy member_invites.

create or replace function public.recover_magic_link_tenant_membership(
  p_member_id integer,
  p_preferred_slug text default null
)
returns table (
  tenant_id uuid,
  tenant_slug text,
  role text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  member_record public.members%rowtype;
  invite_record public.magic_link_invites%rowtype;
  legacy_invite_record public.member_invites%rowtype;
  target_tenant_id uuid;
  target_role text;
  normalized_preferred_slug text;
begin
  if p_member_id is null then
    return;
  end if;

  select *
  into member_record
  from public.members
  where id = p_member_id
  limit 1;

  if member_record.id is null then
    return;
  end if;

  if member_record.auth_id is null or member_record.auth_id <> auth.uid() then
    return;
  end if;

  if coalesce(btrim(member_record.email), '') = '' then
    return;
  end if;

  normalized_preferred_slug := lower(btrim(coalesce(p_preferred_slug, '')));

  if normalized_preferred_slug <> '' then
    select mli.*
    into invite_record
    from public.magic_link_invites mli
    join public.tenants t on t.id = mli.tenant_id
    where lower(coalesce(mli.email, '')) = lower(member_record.email)
      and lower(coalesce(mli.status, 'pending')) in ('pending', 'sent', 'used')
      and (
        lower(coalesce(mli.status, 'pending')) = 'used'
        or mli.expires_at is null
        or mli.expires_at > now()
      )
      and lower(coalesce(t.slug, '')) = normalized_preferred_slug
    order by mli.created_at desc
    limit 1;
  end if;

  if invite_record.id is null then
    select mli.*
    into invite_record
    from public.magic_link_invites mli
    where lower(coalesce(mli.email, '')) = lower(member_record.email)
      and lower(coalesce(mli.status, 'pending')) in ('pending', 'sent', 'used')
      and (
        lower(coalesce(mli.status, 'pending')) = 'used'
        or mli.expires_at is null
        or mli.expires_at > now()
      )
    order by mli.created_at desc
    limit 1;
  end if;

  if invite_record.id is not null and invite_record.tenant_id is not null then
    target_tenant_id := invite_record.tenant_id;
    target_role := coalesce(nullif(btrim(invite_record.role), ''), 'member');
  else
    if normalized_preferred_slug <> '' then
      select mi.*
      into legacy_invite_record
      from public.member_invites mi
      join public.tenants t on t.id = mi.tenant_id
      where lower(coalesce(mi.email, '')) = lower(member_record.email)
        and lower(coalesce(mi.status, 'pending')) in ('pending', 'used')
        and (
          lower(coalesce(mi.status, 'pending')) = 'used'
          or mi.expires_at is null
          or mi.expires_at > now()
        )
        and lower(coalesce(t.slug, '')) = normalized_preferred_slug
      order by mi.created_at desc
      limit 1;
    end if;

    if legacy_invite_record.id is null then
      select mi.*
      into legacy_invite_record
      from public.member_invites mi
      where lower(coalesce(mi.email, '')) = lower(member_record.email)
        and lower(coalesce(mi.status, 'pending')) in ('pending', 'used')
        and (
          lower(coalesce(mi.status, 'pending')) = 'used'
          or mi.expires_at is null
          or mi.expires_at > now()
        )
      order by mi.created_at desc
      limit 1;
    end if;

    if legacy_invite_record.id is null or legacy_invite_record.tenant_id is null then
      return;
    end if;

    target_tenant_id := legacy_invite_record.tenant_id;
    target_role := coalesce(nullif(btrim(legacy_invite_record.role), ''), 'member');
  end if;

  insert into public.tenant_members (tenant_id, member_id, role, status)
  values (target_tenant_id, p_member_id, target_role, 'active')
  on conflict (tenant_id, member_id)
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now();

  if invite_record.id is not null then
    perform public.apply_magic_link_invite_project_access(invite_record.id, p_member_id);

    update public.magic_link_invites
    set
      status = 'used',
      used_at = coalesce(used_at, now()),
      used_by = coalesce(used_by, p_member_id)
    where id = invite_record.id
      and lower(coalesce(status, 'pending')) in ('pending', 'sent', 'used');
  end if;

  if legacy_invite_record.id is not null then
    update public.member_invites
    set
      status = 'used',
      used_at = coalesce(used_at, now()),
      used_by = coalesce(used_by, p_member_id)
    where id = legacy_invite_record.id
      and lower(coalesce(status, 'pending')) in ('pending', 'used');
  end if;

  return query
  select
    t.id,
    t.slug,
    target_role
  from public.tenants t
  where t.id = target_tenant_id
  limit 1;
end;
$function$;

grant execute on function public.recover_magic_link_tenant_membership(integer, text) to authenticated;
