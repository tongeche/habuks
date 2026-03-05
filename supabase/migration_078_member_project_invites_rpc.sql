-- Migration 078: Member-facing pending project invite inbox
-- Lets authenticated members list their own active project-scoped invites
-- within the current tenant workspace.

create or replace function public.get_my_project_magic_link_invites(p_tenant_id uuid default null)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  role text,
  status text,
  invite_number text,
  created_at timestamptz,
  expires_at timestamptz,
  project_access_scope text,
  project_ids integer[],
  project_names text[]
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with current_member as (
    select
      m.id as member_id,
      lower(
        coalesce(
          nullif(btrim(m.email), ''),
          nullif(btrim(auth.jwt() ->> 'email'), '')
        )
      ) as member_email
    from public.members m
    where m.auth_id = auth.uid()
    limit 1
  ),
  scoped_invites as (
    select mli.*
    from public.magic_link_invites mli
    join current_member cm
      on cm.member_email is not null
     and lower(coalesce(mli.email, '')) = cm.member_email
    where (p_tenant_id is null or mli.tenant_id = p_tenant_id)
      and lower(coalesce(mli.status, 'pending')) in ('pending', 'sent')
      and (mli.expires_at is null or mli.expires_at > now())
      and lower(coalesce(mli.project_access_scope, 'none')) in ('selected', 'all')
      and exists (
        select 1
        from public.tenant_members tm
        where tm.tenant_id = mli.tenant_id
          and tm.member_id = cm.member_id
          and lower(coalesce(tm.status, 'active')) = 'active'
      )
  )
  select
    invite.id,
    invite.tenant_id,
    invite.email,
    invite.role::text,
    invite.status::text,
    invite.invite_number::text,
    invite.created_at,
    invite.expires_at,
    coalesce(invite.project_access_scope, 'none')::text as project_access_scope,
    coalesce(invite.project_ids, '{}'::integer[]) as project_ids,
    case
      when lower(coalesce(invite.project_access_scope, 'none')) = 'all' then array['All projects']::text[]
      else coalesce(
        (
          select array_agg(p.name order by p.name)
          from public.iga_projects p
          where p.tenant_id = invite.tenant_id
            and p.id = any(coalesce(invite.project_ids, '{}'::integer[]))
        ),
        '{}'::text[]
      )
    end as project_names
  from scoped_invites invite
  order by invite.created_at desc;
$$;

grant execute on function public.get_my_project_magic_link_invites(uuid) to authenticated;
