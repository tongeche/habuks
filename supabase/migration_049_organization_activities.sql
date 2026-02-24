-- Migration 049: Modernize organization activities (meetings) for tenant-safe CRUD

alter table public.meetings
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists location text,
  add column if not exists status text,
  add column if not exists project_id integer references public.iga_projects(id) on delete set null,
  add column if not exists owner_member_id integer references public.members(id) on delete set null,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.meetings
set title = coalesce(nullif(btrim(title), ''), nullif(btrim(agenda), ''), nullif(btrim(type), ''), 'Activity')
where title is null or btrim(title) = '';

update public.meetings
set status = case
  when date < current_date then 'completed'
  when date = current_date then 'today'
  else 'scheduled'
end
where status is null or btrim(status) = '';

alter table public.meetings
  alter column status set default 'scheduled';

alter table public.meetings
  drop constraint if exists meetings_end_after_start_chk;

alter table public.meetings
  add constraint meetings_end_after_start_chk
  check (end_at is null or start_at is null or end_at >= start_at);

create index if not exists meetings_tenant_date_idx on public.meetings(tenant_id, date desc);
create index if not exists meetings_tenant_status_idx on public.meetings(tenant_id, status);
create index if not exists meetings_tenant_project_idx on public.meetings(tenant_id, project_id);
create index if not exists meetings_tenant_owner_idx on public.meetings(tenant_id, owner_member_id);

create or replace function public.touch_meetings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_meetings_touch_updated_at on public.meetings;
create trigger trg_meetings_touch_updated_at
before update on public.meetings
for each row execute function public.touch_meetings_updated_at();

create or replace function public.can_access_organization_activity(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    case
      when p_tenant_id is null then exists (
        select 1
        from public.members m
        where m.auth_id = auth.uid()
          and m.role in ('admin', 'superadmin', 'project_manager')
      )
      else exists (
        select 1
        from public.members m
        left join public.tenant_members tm
          on tm.member_id = m.id
         and tm.tenant_id = p_tenant_id
         and tm.status = 'active'
        where m.auth_id = auth.uid()
          and (
            tm.id is not null
            or m.role in ('admin', 'superadmin', 'project_manager')
          )
      )
    end;
$$;

create or replace function public.can_manage_organization_activity(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.members m
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p_tenant_id
     and tm.status = 'active'
    where m.auth_id = auth.uid()
      and (
        m.role in ('admin', 'superadmin')
        or (p_tenant_id is not null and m.role = 'project_manager')
        or (tm.id is not null and tm.role in ('admin', 'superadmin'))
      )
  );
$$;

grant execute on function public.can_access_organization_activity(uuid) to authenticated;
grant execute on function public.can_manage_organization_activity(uuid) to authenticated;

alter table public.meetings enable row level security;

drop policy if exists "Authenticated can view meetings" on public.meetings;
drop policy if exists "Admins can manage meetings" on public.meetings;
drop policy if exists "Tenant members can view meetings" on public.meetings;
drop policy if exists "Tenant admins can manage meetings" on public.meetings;

create policy "Tenant members can view meetings"
on public.meetings
for select
to authenticated
using (public.can_access_organization_activity(tenant_id));

create policy "Tenant admins can manage meetings"
on public.meetings
for all
to authenticated
using (public.can_manage_organization_activity(tenant_id))
with check (public.can_manage_organization_activity(tenant_id));
