-- Migration 033: Link member profile to auth user (fallback for logins)

create or replace function public.link_member_profile()
returns members
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $function$
declare
  user_id uuid;
  user_email text;
  linked members;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into user_email from auth.users where id = user_id;
  if user_email is null then
    raise exception 'User email not found';
  end if;

  update members
  set auth_id = user_id
  where auth_id is null
    and lower(email) = lower(user_email)
  returning * into linked;

  return linked;
end;
$function$;

revoke all on function public.link_member_profile() from public;

grant execute on function public.link_member_profile() to authenticated;
