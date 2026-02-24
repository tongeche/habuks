-- Migration 040: Harden unified IGA tables for multi-tenant usage
-- Non-destructive migration:
-- 1) Add tenant_id to unified iga_* tables that are still project-only
-- 2) Backfill tenant_id from iga_projects
-- 3) Keep tenant_id synchronized from project_id via trigger
-- 4) Enable RLS (where disabled) and add tenant-aware policies

-- 0) Ensure iga_projects has module_key for module-aware dashboard routing.
alter table iga_projects add column if not exists module_key text;
alter table iga_projects alter column module_key set default 'generic';

update iga_projects
set module_key = case
  when upper(code) = 'JPP' then 'jpp'
  when upper(code) = 'JGF' then 'jgf'
  else coalesce(module_key, 'generic')
end
where module_key is null or module_key = '';

-- Set NOT NULL only when safe.
do $$
begin
  if not exists (select 1 from iga_projects where module_key is null or module_key = '') then
    alter table iga_projects alter column module_key set not null;
  end if;
end $$;

create index if not exists iga_projects_tenant_module_idx on iga_projects (tenant_id, module_key);

-- 1) Add tenant_id + indexes to unified IGA child tables.
alter table iga_activities add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_activities_tenant_idx on iga_activities (tenant_id);
create index if not exists iga_activities_project_idx on iga_activities (project_id);
create index if not exists iga_activities_tenant_project_idx on iga_activities (tenant_id, project_id);

alter table iga_beneficiaries add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_beneficiaries_tenant_idx on iga_beneficiaries (tenant_id);
create index if not exists iga_beneficiaries_project_idx on iga_beneficiaries (project_id);
create index if not exists iga_beneficiaries_tenant_project_idx on iga_beneficiaries (tenant_id, project_id);

alter table iga_budgets add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_budgets_tenant_idx on iga_budgets (tenant_id);
create index if not exists iga_budgets_project_idx on iga_budgets (project_id);
create index if not exists iga_budgets_tenant_project_idx on iga_budgets (tenant_id, project_id);

alter table iga_inventory add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_inventory_tenant_idx on iga_inventory (tenant_id);
create index if not exists iga_inventory_project_idx on iga_inventory (project_id);
create index if not exists iga_inventory_tenant_project_idx on iga_inventory (tenant_id, project_id);

alter table iga_reports add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_reports_tenant_idx on iga_reports (tenant_id);
create index if not exists iga_reports_project_idx on iga_reports (project_id);
create index if not exists iga_reports_tenant_project_idx on iga_reports (tenant_id, project_id);

alter table iga_sales add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_sales_tenant_idx on iga_sales (tenant_id);
create index if not exists iga_sales_project_idx on iga_sales (project_id);
create index if not exists iga_sales_tenant_project_idx on iga_sales (tenant_id, project_id);

alter table iga_training_sessions add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_training_sessions_tenant_idx on iga_training_sessions (tenant_id);
create index if not exists iga_training_sessions_project_idx on iga_training_sessions (project_id);
create index if not exists iga_training_sessions_tenant_project_idx on iga_training_sessions (tenant_id, project_id);

-- 2) Backfill tenant_id from iga_projects.
update iga_activities c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_beneficiaries c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_budgets c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_inventory c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_reports c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_sales c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

update iga_training_sessions c
set tenant_id = p.tenant_id
from iga_projects p
where c.project_id = p.id
  and c.tenant_id is null;

-- 3) Keep tenant_id in sync from project_id on writes.
create or replace function public.set_iga_child_tenant_id()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is not null then
    select p.tenant_id into new.tenant_id
    from public.iga_projects p
    where p.id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_iga_activities_set_tenant on iga_activities;
create trigger trg_iga_activities_set_tenant
before insert or update of project_id on iga_activities
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_beneficiaries_set_tenant on iga_beneficiaries;
create trigger trg_iga_beneficiaries_set_tenant
before insert or update of project_id on iga_beneficiaries
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_budgets_set_tenant on iga_budgets;
create trigger trg_iga_budgets_set_tenant
before insert or update of project_id on iga_budgets
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_inventory_set_tenant on iga_inventory;
create trigger trg_iga_inventory_set_tenant
before insert or update of project_id on iga_inventory
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_reports_set_tenant on iga_reports;
create trigger trg_iga_reports_set_tenant
before insert or update of project_id on iga_reports
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_sales_set_tenant on iga_sales;
create trigger trg_iga_sales_set_tenant
before insert or update of project_id on iga_sales
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_training_sessions_set_tenant on iga_training_sessions;
create trigger trg_iga_training_sessions_set_tenant
before insert or update of project_id on iga_training_sessions
for each row execute function public.set_iga_child_tenant_id();

-- 4) Access helpers used by RLS policies.
create or replace function public.can_access_iga_project(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        p.tenant_id is null
        or tm.id is not null
        or m.role in ('admin', 'superadmin', 'project_manager')
      )
  );
$$;

create or replace function public.can_manage_iga_project(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        m.role in ('admin', 'superadmin', 'project_manager')
        or p.project_leader = m.id
        or (tm.id is not null and tm.role = 'admin')
      )
  );
$$;

grant execute on function public.can_access_iga_project(integer) to authenticated;
grant execute on function public.can_manage_iga_project(integer) to authenticated;

-- 5) Enable RLS and add tenant-aware policies for unified iga_* child tables.
alter table iga_activities enable row level security;
alter table iga_beneficiaries enable row level security;
alter table iga_budgets enable row level security;
alter table iga_inventory enable row level security;
alter table iga_reports enable row level security;
alter table iga_sales enable row level security;
alter table iga_training_sessions enable row level security;

drop policy if exists "Authenticated can view iga activities" on iga_activities;
create policy "Authenticated can view iga activities"
on iga_activities
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga activities" on iga_activities;
create policy "Project managers can manage iga activities"
on iga_activities
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga beneficiaries" on iga_beneficiaries;
create policy "Authenticated can view iga beneficiaries"
on iga_beneficiaries
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga beneficiaries" on iga_beneficiaries;
create policy "Project managers can manage iga beneficiaries"
on iga_beneficiaries
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga budgets" on iga_budgets;
create policy "Authenticated can view iga budgets"
on iga_budgets
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga budgets" on iga_budgets;
create policy "Project managers can manage iga budgets"
on iga_budgets
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga inventory" on iga_inventory;
create policy "Authenticated can view iga inventory"
on iga_inventory
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga inventory" on iga_inventory;
create policy "Project managers can manage iga inventory"
on iga_inventory
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga reports" on iga_reports;
create policy "Authenticated can view iga reports"
on iga_reports
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga reports" on iga_reports;
create policy "Project managers can manage iga reports"
on iga_reports
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga sales" on iga_sales;
create policy "Authenticated can view iga sales"
on iga_sales
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga sales" on iga_sales;
create policy "Project managers can manage iga sales"
on iga_sales
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view iga training sessions" on iga_training_sessions;
create policy "Authenticated can view iga training sessions"
on iga_training_sessions
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage iga training sessions" on iga_training_sessions;
create policy "Project managers can manage iga training sessions"
on iga_training_sessions
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));
