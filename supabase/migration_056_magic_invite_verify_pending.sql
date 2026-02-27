-- Migration 056: Allow pending magic-link invites to be verified on /register
-- The UI shares invite numbers immediately after creation, before any "sent" state.

create or replace function public.verify_magic_link_invite(p_invite_number text)
returns table (
  id uuid,
  tenant_id uuid,
  email text,
  phone_number text,
  role varchar,
  invite_number varchar,
  status varchar,
  created_at timestamptz,
  expires_at timestamptz
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
    mli.expires_at
  from public.magic_link_invites mli
  where mli.invite_number = p_invite_number
    and lower(coalesce(mli.status, 'pending')) in ('pending', 'sent')
    and (mli.expires_at is null or mli.expires_at > now())
  order by mli.created_at desc
  limit 1;
end;
$function$;

grant execute on function public.verify_magic_link_invite(text) to authenticated, anon;
