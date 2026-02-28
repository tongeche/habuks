-- Migration 074: Tenant member audit trail + tenant-scoped invite actions
--
-- Goals:
-- 1) Record tenant membership promotions, dismissals, reinstatements, and removals
--    with actor and timestamp data.
-- 2) Let tenant admins manage magic-link invites inside their own workspace.

create table if not exists public.tenant_member_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_membership_id uuid,
  member_id integer references public.members(id) on delete set null,
  member_name text,
  actor_member_id integer references public.members(id) on delete set null,
  actor_name text,
  action text not null,
  previous_role text,
  next_role text,
  previous_status text,
  next_status text,
  note text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists tenant_member_audit_log_tenant_occurred_idx
  on public.tenant_member_audit_log (tenant_id, occurred_at desc);

create index if not exists tenant_member_audit_log_member_occurred_idx
  on public.tenant_member_audit_log (member_id, occurred_at desc);

create index if not exists tenant_member_audit_log_membership_idx
  on public.tenant_member_audit_log (tenant_membership_id);

alter table public.tenant_member_audit_log enable row level security;

create or replace function public.can_view_tenant_member_audit_log(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select public.is_admin() or public.is_tenant_admin(p_tenant_id);
$$;

grant execute on function public.can_view_tenant_member_audit_log(uuid) to authenticated;
grant select on public.tenant_member_audit_log to authenticated;

drop policy if exists "Tenant admins view tenant member audit log" on public.tenant_member_audit_log;
create policy "Tenant admins view tenant member audit log"
on public.tenant_member_audit_log
for select
to authenticated
using (public.can_view_tenant_member_audit_log(tenant_id));

create or replace function public.can_manage_tenant_invites(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select public.is_admin() or public.is_tenant_admin(p_tenant_id);
$$;

grant execute on function public.can_manage_tenant_invites(uuid) to authenticated;

drop policy if exists "Tenant admins read tenant magic link invites" on public.magic_link_invites;
create policy "Tenant admins read tenant magic link invites"
on public.magic_link_invites
for select
to authenticated
using (public.can_manage_tenant_invites(tenant_id));

drop policy if exists "Tenant admins insert tenant magic link invites" on public.magic_link_invites;
create policy "Tenant admins insert tenant magic link invites"
on public.magic_link_invites
for insert
to authenticated
with check (public.can_manage_tenant_invites(tenant_id));

drop policy if exists "Tenant admins update tenant magic link invites" on public.magic_link_invites;
create policy "Tenant admins update tenant magic link invites"
on public.magic_link_invites
for update
to authenticated
using (public.can_manage_tenant_invites(tenant_id))
with check (public.can_manage_tenant_invites(tenant_id));

drop policy if exists "Tenant admins delete tenant magic link invites" on public.magic_link_invites;
create policy "Tenant admins delete tenant magic link invites"
on public.magic_link_invites
for delete
to authenticated
using (public.can_manage_tenant_invites(tenant_id));

create or replace function public.log_tenant_member_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_member_id_value integer;
  actor_name_value text;
  target_member_id_value integer;
  target_member_name_value text;
  normalized_old_role text;
  normalized_new_role text;
  normalized_old_status text;
  normalized_new_status text;
  role_note text;
  status_note text;
begin
  select m.id, nullif(btrim(m.name), '')
  into actor_member_id_value, actor_name_value
  from public.members m
  where m.auth_id = auth.uid()
  limit 1;

  if tg_op = 'DELETE' then
    target_member_id_value := old.member_id;
  else
    target_member_id_value := new.member_id;
  end if;

  select coalesce(nullif(btrim(m.name), ''), 'Member #' || target_member_id_value::text)
  into target_member_name_value
  from public.members m
  where m.id = target_member_id_value
  limit 1;

  target_member_name_value := coalesce(target_member_name_value, 'Member #' || target_member_id_value::text);
  actor_name_value := coalesce(actor_name_value, 'System');

  if tg_op = 'INSERT' then
    insert into public.tenant_member_audit_log (
      tenant_id,
      tenant_membership_id,
      member_id,
      member_name,
      actor_member_id,
      actor_name,
      action,
      previous_role,
      next_role,
      previous_status,
      next_status,
      note,
      metadata
    )
    values (
      new.tenant_id,
      new.id,
      new.member_id,
      target_member_name_value,
      actor_member_id_value,
      actor_name_value,
      'membership_added',
      null,
      new.role,
      null,
      new.status,
      case
        when lower(coalesce(new.status, 'active')) = 'active'
          then 'Added to the organization as ' || initcap(replace(coalesce(new.role, 'member'), '_', ' ')) || '.'
        else
          'Added to the organization as '
          || initcap(replace(coalesce(new.role, 'member'), '_', ' '))
          || ' with '
          || lower(coalesce(new.status, 'pending'))
          || ' status.'
      end,
      jsonb_build_object('operation', tg_op, 'source', 'tenant_members')
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    normalized_old_role := lower(coalesce(old.role, 'member'));
    normalized_new_role := lower(coalesce(new.role, old.role, 'member'));
    normalized_old_status := lower(coalesce(old.status, 'active'));
    normalized_new_status := lower(coalesce(new.status, old.status, 'active'));

    if normalized_old_role is distinct from normalized_new_role then
      role_note := case
        when normalized_old_role not in ('admin', 'superadmin')
          and normalized_new_role in ('admin', 'superadmin')
          then 'Made admin.'
        when normalized_old_role in ('admin', 'superadmin')
          and normalized_new_role not in ('admin', 'superadmin')
          then 'Removed admin powers and changed role to ' || initcap(replace(normalized_new_role, '_', ' ')) || '.'
        else
          'Changed organization role from '
          || initcap(replace(normalized_old_role, '_', ' '))
          || ' to '
          || initcap(replace(normalized_new_role, '_', ' '))
          || '.'
      end;

      insert into public.tenant_member_audit_log (
        tenant_id,
        tenant_membership_id,
        member_id,
        member_name,
        actor_member_id,
        actor_name,
        action,
        previous_role,
        next_role,
        previous_status,
        next_status,
        note,
        metadata
      )
      values (
        new.tenant_id,
        new.id,
        new.member_id,
        target_member_name_value,
        actor_member_id_value,
        actor_name_value,
        case
          when normalized_old_role not in ('admin', 'superadmin')
            and normalized_new_role in ('admin', 'superadmin')
            then 'made_admin'
          else 'role_changed'
        end,
        old.role,
        new.role,
        old.status,
        new.status,
        role_note,
        jsonb_build_object('operation', tg_op, 'source', 'tenant_members')
      );
    end if;

    if normalized_old_status is distinct from normalized_new_status then
      status_note := case
        when normalized_old_status = 'active' and normalized_new_status = 'inactive'
          then 'Dismissed from active organization access.'
        when normalized_old_status = 'inactive' and normalized_new_status = 'active'
          then 'Reinstated to active organization access.'
        when normalized_old_status = 'pending' and normalized_new_status = 'active'
          then 'Activated organization access.'
        else
          'Changed organization status from '
          || initcap(replace(normalized_old_status, '_', ' '))
          || ' to '
          || initcap(replace(normalized_new_status, '_', ' '))
          || '.'
      end;

      insert into public.tenant_member_audit_log (
        tenant_id,
        tenant_membership_id,
        member_id,
        member_name,
        actor_member_id,
        actor_name,
        action,
        previous_role,
        next_role,
        previous_status,
        next_status,
        note,
        metadata
      )
      values (
        new.tenant_id,
        new.id,
        new.member_id,
        target_member_name_value,
        actor_member_id_value,
        actor_name_value,
        case
          when normalized_old_status = 'active' and normalized_new_status = 'inactive'
            then 'dismissed'
          when normalized_old_status = 'inactive' and normalized_new_status = 'active'
            then 'reinstated'
          else 'status_changed'
        end,
        old.role,
        new.role,
        old.status,
        new.status,
        status_note,
        jsonb_build_object('operation', tg_op, 'source', 'tenant_members')
      );
    end if;

    return new;
  end if;

  insert into public.tenant_member_audit_log (
    tenant_id,
    tenant_membership_id,
    member_id,
    member_name,
    actor_member_id,
    actor_name,
    action,
    previous_role,
    next_role,
    previous_status,
    next_status,
    note,
    metadata
  )
  values (
    old.tenant_id,
    old.id,
    old.member_id,
    target_member_name_value,
    actor_member_id_value,
    actor_name_value,
    'membership_removed',
    old.role,
    null,
    old.status,
    null,
    'Terminated from the organization.',
    jsonb_build_object('operation', tg_op, 'source', 'tenant_members')
  );

  return old;
end;
$function$;

drop trigger if exists trg_tenant_member_audit_log on public.tenant_members;
create trigger trg_tenant_member_audit_log
after insert or update or delete on public.tenant_members
for each row execute function public.log_tenant_member_audit_event();
