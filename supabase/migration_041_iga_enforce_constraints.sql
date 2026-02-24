-- Migration 041: Enforce stricter integrity for unified IGA projects and child tables
-- Safe enforcement goals:
-- 1) Normalize and validate iga_projects.module_key
-- 2) Ensure unified iga_* child rows always belong to a project (project_id NOT NULL)
-- 3) Force tenant_id to stay synchronized from project_id on every insert/update

-- 1) Normalize module_key and enforce format.
update public.iga_projects
set module_key = case
  when module_key is null or btrim(module_key) = '' then
    case
      when upper(code) = 'JPP' then 'jpp'
      when upper(code) = 'JGF' then 'jgf'
      else 'generic'
    end
  else lower(btrim(module_key))
end
where module_key is null
   or btrim(module_key) = ''
   or module_key <> lower(btrim(module_key));

alter table public.iga_projects
  alter column module_key set default 'generic',
  alter column module_key set not null;

alter table public.iga_projects
  drop constraint if exists iga_projects_module_key_format_chk;

alter table public.iga_projects
  add constraint iga_projects_module_key_format_chk
  check (module_key ~ '^[a-z][a-z0-9_]*$');

create index if not exists iga_projects_module_key_idx
  on public.iga_projects (module_key);

-- 2) Child records must always point to a project.
alter table public.iga_activities alter column project_id set not null;
alter table public.iga_beneficiaries alter column project_id set not null;
alter table public.iga_budgets alter column project_id set not null;
alter table public.iga_inventory alter column project_id set not null;
alter table public.iga_reports alter column project_id set not null;
alter table public.iga_sales alter column project_id set not null;
alter table public.iga_training_sessions alter column project_id set not null;

-- 3) Enforce tenant sync from project on every write.
create or replace function public.set_iga_child_tenant_id()
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

drop trigger if exists trg_iga_activities_set_tenant on public.iga_activities;
create trigger trg_iga_activities_set_tenant
before insert or update on public.iga_activities
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_beneficiaries_set_tenant on public.iga_beneficiaries;
create trigger trg_iga_beneficiaries_set_tenant
before insert or update on public.iga_beneficiaries
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_budgets_set_tenant on public.iga_budgets;
create trigger trg_iga_budgets_set_tenant
before insert or update on public.iga_budgets
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_inventory_set_tenant on public.iga_inventory;
create trigger trg_iga_inventory_set_tenant
before insert or update on public.iga_inventory
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_reports_set_tenant on public.iga_reports;
create trigger trg_iga_reports_set_tenant
before insert or update on public.iga_reports
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_sales_set_tenant on public.iga_sales;
create trigger trg_iga_sales_set_tenant
before insert or update on public.iga_sales
for each row execute function public.set_iga_child_tenant_id();

drop trigger if exists trg_iga_training_sessions_set_tenant on public.iga_training_sessions;
create trigger trg_iga_training_sessions_set_tenant
before insert or update on public.iga_training_sessions
for each row execute function public.set_iga_child_tenant_id();
