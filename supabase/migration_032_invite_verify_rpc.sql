-- Migration 032: Invite verification RPC for public signup

create extension if not exists "pgcrypto";

create or replace function public.verify_member_invite(code text)
returns member_invites
language plpgsql
security definer
set search_path = public
as $function$
declare
  trimmed text;
  normalized text;
  compact text;
  dashed text;
  code_hash text;
  code_hash_alt text;
  code_hash_compact text;
  invite member_invites;
  prefix text;
begin
  trimmed := btrim(code);
  if trimmed is null or trimmed = '' then
    raise exception 'Invite code is required.';
  end if;

  normalized := upper(trimmed);
  compact := replace(normalized, '-', '');

  if length(compact) = 15 and left(compact, 3) = 'JNG' then
    dashed := 'JNG-' || substr(compact, 4, 4) || '-' || substr(compact, 8, 4) || '-' || substr(compact, 12, 4);
  elsif length(compact) = 12 then
    dashed := 'JNG-' || substr(compact, 1, 4) || '-' || substr(compact, 5, 4) || '-' || substr(compact, 9, 4);
  else
    dashed := normalized;
  end if;

  code_hash := encode(digest(dashed, 'sha256'), 'hex');
  code_hash_alt := encode(digest(normalized, 'sha256'), 'hex');
  code_hash_compact := encode(digest(compact, 'sha256'), 'hex');

  select * into invite
  from member_invites
  where code_hash in (code_hash, code_hash_alt, code_hash_compact)
     or code_hash = normalized
     or replace(code_hash, '-', '') = compact
  order by created_at desc
  limit 1;

  if invite.id is null and length(compact) >= 8 then
    prefix := left(compact, 8);
    select * into invite
    from member_invites
    where code_prefix = prefix
    order by created_at desc
    limit 1;

    if invite.id is not null then
      if invite.code_hash not in (code_hash, code_hash_alt, code_hash_compact, normalized)
         and replace(invite.code_hash, '-', '') <> compact then
        invite := null;
      end if;
    end if;
  end if;

  if invite.id is null then
    raise exception 'Invalid invite code.';
  end if;

  if invite.status is not null and lower(invite.status) <> 'pending' then
    raise exception 'This invite code is no longer active.';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    raise exception 'This invite code has expired.';
  end if;

  return invite;
end;
$function$;

revoke all on function public.verify_member_invite(text) from public;

grant execute on function public.verify_member_invite(text) to anon, authenticated;
