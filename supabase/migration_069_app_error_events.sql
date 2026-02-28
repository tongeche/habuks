-- Migration 069: Application error event sink
--
-- Goals:
-- 1) Create a dedicated table for client-side application error events.
-- 2) Allow authenticated users to insert logs for their own session.
-- 3) Keep tenant-scoped validation conservative to reduce spoofing.

create extension if not exists pgcrypto;

create or replace function public.can_report_tenant_error(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    p_tenant_id is null
    or exists (
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
    );
$$;

grant execute on function public.can_report_tenant_error(uuid) to authenticated;

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  auth_user_id uuid not null default auth.uid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  member_id integer references public.members(id) on delete set null,
  level text not null default 'error',
  area text,
  action text,
  code text,
  message text not null,
  page_path text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists app_error_events_created_at_idx
  on public.app_error_events (created_at desc);

create index if not exists app_error_events_tenant_idx
  on public.app_error_events (tenant_id, created_at desc);

create index if not exists app_error_events_member_idx
  on public.app_error_events (member_id, created_at desc);

create index if not exists app_error_events_auth_user_idx
  on public.app_error_events (auth_user_id, created_at desc);

create index if not exists app_error_events_level_idx
  on public.app_error_events (level, created_at desc);

alter table public.app_error_events enable row level security;

drop policy if exists "Authenticated users insert app error events" on public.app_error_events;
create policy "Authenticated users insert app error events"
on public.app_error_events
for insert
to authenticated
with check (
  auth.uid() is not null
  and auth_user_id = auth.uid()
  and public.can_report_tenant_error(tenant_id)
  and (
    member_id is null
    or exists (
      select 1
      from public.members m
      where m.id = member_id
        and m.auth_id = auth.uid()
    )
  )
);

drop policy if exists "Users read own app error events" on public.app_error_events;
create policy "Users read own app error events"
on public.app_error_events
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or (
    tenant_id is not null
    and public.is_tenant_admin(tenant_id)
  )
);
