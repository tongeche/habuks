-- Migration 083: Internal admin support layer (MVP)
--
-- Adds:
-- 1) admin_users: internal support/admin allowlist by email
-- 2) audit_logs: lightweight cross-tenant operational audit events
-- 3) security-definer helpers + RPCs for internal admin tenant search/overview/logs

create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'support',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_role_check check (lower(role) in ('super_admin', 'support', 'billing'))
);

create index if not exists admin_users_role_idx
  on public.admin_users (lower(role));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_member_id integer references public.members(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_member_id, created_at desc);

create index if not exists audit_logs_action_created_idx
  on public.audit_logs (action, created_at desc);

create or replace function public.normalize_admin_user_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(coalesce(new.email, '')));
  new.role := lower(btrim(coalesce(new.role, 'support')));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_admin_users_normalize on public.admin_users;
create trigger trg_admin_users_normalize
before insert or update on public.admin_users
for each row execute function public.normalize_admin_user_write();

create or replace function public.auth_user_email()
returns text
language sql
stable
as $$
  select nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');
$$;

grant execute on function public.auth_user_email() to authenticated;

create or replace function public.is_internal_admin(p_email text default null)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  with candidate_email as (
    select coalesce(
      nullif(lower(btrim(coalesce(p_email, ''))), ''),
      public.auth_user_email()
    ) as value
  )
  select exists (
    select 1
    from public.admin_users au
    cross join candidate_email ce
    where ce.value is not null
      and lower(au.email) = ce.value
  );
$$;

grant execute on function public.is_internal_admin(text) to authenticated;

create or replace function public.is_internal_super_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(au.email) = public.auth_user_email()
      and lower(au.role) = 'super_admin'
  );
$$;

grant execute on function public.is_internal_super_admin() to authenticated;

create or replace function public.current_actor_member_id()
returns integer
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select m.id
  from public.members m
  where m.auth_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_actor_member_id() to authenticated;

create or replace function public.can_insert_audit_log(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor_member_id integer;
begin
  if public.is_internal_admin() then
    return true;
  end if;

  v_actor_member_id := public.current_actor_member_id();
  if v_actor_member_id is null then
    return false;
  end if;

  if p_tenant_id is null then
    return public.is_admin();
  end if;

  if public.is_admin() or public.is_tenant_admin(p_tenant_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.member_id = v_actor_member_id
      and lower(coalesce(tm.status, 'active')) = 'active'
  );
end;
$$;

grant execute on function public.can_insert_audit_log(uuid) to authenticated;

create or replace function public.audit_logs_set_actor_member()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor_member_id integer;
begin
  v_actor_member_id := public.current_actor_member_id();
  if v_actor_member_id is not null then
    new.actor_member_id := v_actor_member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_logs_set_actor on public.audit_logs;
create trigger trg_audit_logs_set_actor
before insert on public.audit_logs
for each row execute function public.audit_logs_set_actor_member();

create or replace function public.log_audit_event(
  p_tenant_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_action text := nullif(btrim(coalesce(p_action, '')), '');
  v_entity text := nullif(btrim(coalesce(p_entity, '')), '');
  v_entity_id text := nullif(btrim(coalesce(p_entity_id, '')), '');
  v_actor_member_id integer;
  v_log_id uuid;
begin
  if v_action is null then
    raise exception 'Action is required.';
  end if;

  if v_entity is null then
    raise exception 'Entity is required.';
  end if;

  if not public.can_insert_audit_log(p_tenant_id) then
    raise exception 'Not authorized to write audit logs.';
  end if;

  v_actor_member_id := public.current_actor_member_id();

  insert into public.audit_logs (
    tenant_id,
    actor_member_id,
    action,
    entity,
    entity_id,
    metadata
  )
  values (
    p_tenant_id,
    v_actor_member_id,
    v_action,
    v_entity,
    v_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

grant execute on function public.log_audit_event(uuid, text, text, text, jsonb) to authenticated;

alter table public.admin_users enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update, delete on public.admin_users to authenticated;
grant select, insert on public.audit_logs to authenticated;

drop policy if exists "Internal admins read admin users" on public.admin_users;
create policy "Internal admins read admin users"
on public.admin_users
for select
to authenticated
using (public.is_internal_admin());

drop policy if exists "Internal super admins manage admin users" on public.admin_users;
create policy "Internal super admins manage admin users"
on public.admin_users
for all
to authenticated
using (public.is_internal_super_admin())
with check (public.is_internal_super_admin());

drop policy if exists "Internal admins read audit logs" on public.audit_logs;
create policy "Internal admins read audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_internal_admin());

drop policy if exists "Authorized actors insert audit logs" on public.audit_logs;
create policy "Authorized actors insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (public.can_insert_audit_log(tenant_id));

create or replace function public.admin_list_tenants(
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  tenant_id uuid,
  tenant_name text,
  slug text,
  location text,
  contact_email text,
  created_at timestamptz,
  active_members_count bigint,
  projects_count bigint,
  transactions_count bigint
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with scoped_tenants as (
    select
      t.id,
      t.name,
      t.slug,
      t.location,
      t.contact_email,
      t.created_at
    from public.tenants t
    where public.is_internal_admin()
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or t.name ilike '%' || btrim(coalesce(p_search, '')) || '%'
        or t.slug ilike '%' || btrim(coalesce(p_search, '')) || '%'
        or t.contact_email ilike '%' || btrim(coalesce(p_search, '')) || '%'
      )
    order by t.created_at desc
    limit greatest(coalesce(p_limit, 100), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    st.id as tenant_id,
    st.name as tenant_name,
    st.slug,
    st.location,
    st.contact_email,
    st.created_at,
    (
      select count(*)
      from public.tenant_members tm
      where tm.tenant_id = st.id
        and lower(coalesce(tm.status, 'active')) = 'active'
    ) as active_members_count,
    (
      select count(*)
      from public.iga_projects p
      where p.tenant_id = st.id
    ) as projects_count,
    (
      coalesce((select count(*) from public.project_expenses pe where pe.tenant_id = st.id), 0)
      + coalesce((select count(*) from public.project_sales ps where ps.tenant_id = st.id), 0)
      + coalesce((select count(*) from public.contributions c where c.tenant_id = st.id), 0)
      + coalesce((select count(*) from public.payouts po where po.tenant_id = st.id), 0)
      + coalesce((select count(*) from public.welfare_transactions wt where wt.tenant_id = st.id), 0)
    ) as transactions_count
  from scoped_tenants st
  order by st.created_at desc;
$$;

grant execute on function public.admin_list_tenants(text, integer, integer) to authenticated;

create or replace function public.admin_get_tenant_overview(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  tenant_name text,
  slug text,
  location text,
  contact_email text,
  contact_phone text,
  created_at timestamptz,
  active_members_count bigint,
  projects_count bigint,
  transactions_count bigint,
  documents_count bigint
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug,
    t.location,
    t.contact_email,
    t.contact_phone,
    t.created_at,
    (
      select count(*)
      from public.tenant_members tm
      where tm.tenant_id = t.id
        and lower(coalesce(tm.status, 'active')) = 'active'
    ) as active_members_count,
    (
      select count(*)
      from public.iga_projects p
      where p.tenant_id = t.id
    ) as projects_count,
    (
      coalesce((select count(*) from public.project_expenses pe where pe.tenant_id = t.id), 0)
      + coalesce((select count(*) from public.project_sales ps where ps.tenant_id = t.id), 0)
      + coalesce((select count(*) from public.contributions c where c.tenant_id = t.id), 0)
      + coalesce((select count(*) from public.payouts po where po.tenant_id = t.id), 0)
      + coalesce((select count(*) from public.welfare_transactions wt where wt.tenant_id = t.id), 0)
    ) as transactions_count,
    (
      select count(*)
      from public.documents d
      where d.tenant_id = t.id
    ) as documents_count
  from public.tenants t
  where public.is_internal_admin()
    and t.id = p_tenant_id
  limit 1;
$$;

grant execute on function public.admin_get_tenant_overview(uuid) to authenticated;

create or replace function public.admin_get_tenant_members(
  p_tenant_id uuid,
  p_limit integer default 200
)
returns table (
  tenant_membership_id uuid,
  member_id integer,
  member_name text,
  email text,
  phone_number text,
  tenant_role text,
  tenant_status text,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    tm.id as tenant_membership_id,
    m.id as member_id,
    m.name as member_name,
    m.email,
    m.phone_number,
    tm.role as tenant_role,
    tm.status as tenant_status,
    tm.created_at as joined_at
  from public.tenant_members tm
  join public.members m
    on m.id = tm.member_id
  where public.is_internal_admin()
    and tm.tenant_id = p_tenant_id
  order by tm.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

grant execute on function public.admin_get_tenant_members(uuid, integer) to authenticated;

create or replace function public.admin_get_tenant_projects(
  p_tenant_id uuid,
  p_limit integer default 200
)
returns table (
  project_id integer,
  project_name text,
  module_key text,
  status text,
  start_date date,
  created_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    p.id as project_id,
    p.name as project_name,
    p.module_key,
    p.status,
    p.start_date,
    p.created_at
  from public.iga_projects p
  where public.is_internal_admin()
    and p.tenant_id = p_tenant_id
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

grant execute on function public.admin_get_tenant_projects(uuid, integer) to authenticated;

create or replace function public.admin_get_tenant_transactions(
  p_tenant_id uuid,
  p_limit integer default 200
)
returns table (
  source text,
  transaction_id text,
  amount numeric,
  occurred_at timestamptz,
  project_id integer,
  member_id integer,
  details text
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with tx as (
    select
      'project_expense'::text as source,
      pe.id::text as transaction_id,
      pe.amount,
      coalesce(pe.created_at, pe.expense_date::timestamptz) as occurred_at,
      pe.project_id,
      null::integer as member_id,
      coalesce(pe.category, pe.description, pe.vendor) as details
    from public.project_expenses pe
    where pe.tenant_id = p_tenant_id

    union all

    select
      'project_sale'::text as source,
      ps.id::text as transaction_id,
      ps.total_amount as amount,
      coalesce(ps.created_at, ps.sale_date::timestamptz) as occurred_at,
      ps.project_id,
      null::integer as member_id,
      coalesce(ps.product_type, ps.customer_name) as details
    from public.project_sales ps
    where ps.tenant_id = p_tenant_id

    union all

    select
      'contribution'::text as source,
      c.id::text as transaction_id,
      c.amount,
      c.date::timestamptz as occurred_at,
      null::integer as project_id,
      c.member_id,
      ('Cycle #' || coalesce(c.cycle_number::text, '-')) as details
    from public.contributions c
    where c.tenant_id = p_tenant_id

    union all

    select
      'payout'::text as source,
      po.id::text as transaction_id,
      po.amount,
      po.date::timestamptz as occurred_at,
      null::integer as project_id,
      po.member_id,
      ('Cycle #' || coalesce(po.cycle_number::text, '-')) as details
    from public.payouts po
    where po.tenant_id = p_tenant_id

    union all

    select
      'welfare_transaction'::text as source,
      wt.id::text as transaction_id,
      wt.amount,
      wt.date::timestamptz as occurred_at,
      null::integer as project_id,
      wt.member_id,
      wt.description as details
    from public.welfare_transactions wt
    where wt.tenant_id = p_tenant_id
  )
  select
    tx.source,
    tx.transaction_id,
    tx.amount,
    tx.occurred_at,
    tx.project_id,
    tx.member_id,
    tx.details
  from tx
  where public.is_internal_admin()
  order by tx.occurred_at desc nulls last
  limit greatest(coalesce(p_limit, 200), 1);
$$;

grant execute on function public.admin_get_tenant_transactions(uuid, integer) to authenticated;

create or replace function public.admin_get_activity_logs(
  p_tenant_id uuid default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  log_id uuid,
  tenant_id uuid,
  tenant_name text,
  actor_member_id integer,
  actor_name text,
  action text,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    l.id as log_id,
    l.tenant_id,
    t.name as tenant_name,
    l.actor_member_id,
    coalesce(m.name, 'System') as actor_name,
    l.action,
    l.entity,
    l.entity_id,
    l.metadata,
    l.created_at
  from public.audit_logs l
  left join public.tenants t
    on t.id = l.tenant_id
  left join public.members m
    on m.id = l.actor_member_id
  where public.is_internal_admin()
    and (
      p_tenant_id is null
      or l.tenant_id = p_tenant_id
    )
  order by l.created_at desc
  limit greatest(coalesce(p_limit, 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_get_activity_logs(uuid, integer, integer) to authenticated;

insert into public.admin_users (email, role)
values ('timothy@habuks.com', 'super_admin')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();
