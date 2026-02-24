-- Migration 043: Project expense categories catalog (tenant + project scoped)
-- Goals:
-- 1) Persist reusable expense categories per project/tenant.
-- 2) Keep tenant_id synchronized from project_id.
-- 3) Enforce RLS using existing IGA access helpers.

create extension if not exists pgcrypto;

create table if not exists public.project_expense_categories (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.iga_projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.project_expense_categories
  drop constraint if exists project_expense_categories_name_not_blank_chk;

alter table public.project_expense_categories
  add constraint project_expense_categories_name_not_blank_chk
  check (length(btrim(name)) > 0);

create index if not exists project_expense_categories_project_idx
  on public.project_expense_categories (project_id);

create index if not exists project_expense_categories_tenant_idx
  on public.project_expense_categories (tenant_id);

create index if not exists project_expense_categories_project_active_order_idx
  on public.project_expense_categories (project_id, archived_at, display_order);

create unique index if not exists project_expense_categories_project_name_active_uq
  on public.project_expense_categories (project_id, lower(btrim(name)))
  where archived_at is null;

create or replace function public.set_project_expense_category_tenant_id()
returns trigger
language plpgsql
as $$
declare
  v_tenant_id uuid;
begin
  if new.project_id is null then
    new.tenant_id := null;
    return new;
  end if;

  select p.tenant_id
    into v_tenant_id
  from public.iga_projects p
  where p.id = new.project_id;

  if not found then
    raise foreign_key_violation using message = format('Invalid project_id: %s', new.project_id);
  end if;

  new.tenant_id := v_tenant_id;
  return new;
end;
$$;

drop trigger if exists trg_project_expense_categories_set_tenant on public.project_expense_categories;
create trigger trg_project_expense_categories_set_tenant
before insert or update on public.project_expense_categories
for each row execute function public.set_project_expense_category_tenant_id();

create or replace function public.touch_project_expense_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_project_expense_categories_touch_updated_at on public.project_expense_categories;
create trigger trg_project_expense_categories_touch_updated_at
before update on public.project_expense_categories
for each row execute function public.touch_project_expense_categories_updated_at();

alter table public.project_expense_categories enable row level security;

drop policy if exists "Authenticated can view project expense categories" on public.project_expense_categories;
create policy "Authenticated can view project expense categories"
on public.project_expense_categories
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage project expense categories" on public.project_expense_categories;
create policy "Project managers can manage project expense categories"
on public.project_expense_categories
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

with source_categories as (
  select
    t.project_id,
    min(t.category_name) as category_name
  from (
    select
      e.project_id,
      btrim(e.category) as category_name,
      lower(btrim(e.category)) as category_key
    from public.project_expenses e
    where e.category is not null
      and btrim(e.category) <> ''

    union all

    select
      i.project_id,
      btrim(i.category) as category_name,
      lower(btrim(i.category)) as category_key
    from public.project_expense_items i
    where i.category is not null
      and btrim(i.category) <> ''
  ) t
  group by t.project_id, t.category_key
),
ordered_categories as (
  select
    s.project_id,
    p.tenant_id,
    s.category_name,
    row_number() over (
      partition by s.project_id
      order by lower(s.category_name)
    ) - 1 as display_order
  from source_categories s
  join public.iga_projects p
    on p.id = s.project_id
)
insert into public.project_expense_categories (
  project_id,
  tenant_id,
  name,
  display_order
)
select
  o.project_id,
  o.tenant_id,
  o.category_name,
  o.display_order
from ordered_categories o
where not exists (
  select 1
  from public.project_expense_categories c
  where c.project_id = o.project_id
    and c.archived_at is null
    and lower(btrim(c.name)) = lower(o.category_name)
);
