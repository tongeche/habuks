-- Migration 037: Tie JPP/JGF module data to projects (multi-tenant)

-- 1) Projects: add module_key to describe the project type (jpp, jgf, generic, ...)
alter table iga_projects add column if not exists module_key text;
alter table iga_projects alter column module_key set default 'generic';

create index if not exists iga_projects_tenant_module_idx on iga_projects (tenant_id, module_key);

-- Backfill module_key from legacy codes
update iga_projects
set module_key = case
  when upper(code) = 'JPP' then 'jpp'
  when upper(code) = 'JGF' then 'jgf'
  else coalesce(module_key, 'generic')
end
where module_key is null or module_key = '';

alter table iga_projects alter column module_key set not null;

-- 2) Add project_id to JPP tables
alter table jpp_batches add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jpp_batches_project_idx on jpp_batches (project_id);

alter table jpp_daily_log add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jpp_daily_log_project_idx on jpp_daily_log (project_id);

alter table jpp_weekly_growth add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jpp_weekly_growth_project_idx on jpp_weekly_growth (project_id);

alter table jpp_birds add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jpp_birds_project_idx on jpp_birds (project_id);

-- 3) Add project_id to JGF tables
alter table jgf_batches add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_batches_project_idx on jgf_batches (project_id);

alter table jgf_production_logs add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_production_logs_project_idx on jgf_production_logs (project_id);

alter table jgf_sales add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_sales_project_idx on jgf_sales (project_id);

alter table jgf_expenses add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_expenses_project_idx on jgf_expenses (project_id);

alter table jgf_inventory add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_inventory_project_idx on jgf_inventory (project_id);

alter table jgf_purchases add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_purchases_project_idx on jgf_purchases (project_id);

alter table jgf_land_leases add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_land_leases_project_idx on jgf_land_leases (project_id);

alter table jgf_crop_cycles add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_crop_cycles_project_idx on jgf_crop_cycles (project_id);

alter table jgf_farming_activities add column if not exists project_id integer references iga_projects(id) on delete cascade;
create index if not exists jgf_farming_activities_project_idx on jgf_farming_activities (project_id);

-- 4) Backfill project_id for JPP batches using tenant + module_key
update jpp_batches b
set project_id = p.id
from iga_projects p
where b.project_id is null
  and p.module_key = 'jpp'
  and p.tenant_id = b.tenant_id;

-- Backfill project_id for JPP tables from batches
update jpp_daily_log d
set project_id = b.project_id
from jpp_batches b
where d.project_id is null
  and d.batch_id = b.id;

update jpp_weekly_growth w
set project_id = b.project_id
from jpp_batches b
where w.project_id is null
  and w.batch_id = b.id;

update jpp_birds j
set project_id = b.project_id
from jpp_batches b
where j.project_id is null
  and j.batch_id = b.id;

-- 5) Backfill project_id for JGF batches using tenant + module_key
update jgf_batches b
set project_id = p.id
from iga_projects p
where b.project_id is null
  and p.module_key = 'jgf'
  and p.tenant_id = b.tenant_id;

-- Backfill project_id for JGF tables from batches
update jgf_production_logs l
set project_id = b.project_id
from jgf_batches b
where l.project_id is null
  and l.batch_id = b.id;

update jgf_sales s
set project_id = b.project_id
from jgf_batches b
where s.project_id is null
  and s.batch_id = b.id;

update jgf_expenses e
set project_id = b.project_id
from jgf_batches b
where e.project_id is null
  and e.batch_id = b.id;

-- Backfill JGF tables that do not have batch_id
update jgf_inventory i
set project_id = p.id
from iga_projects p
where i.project_id is null
  and p.module_key = 'jgf'
  and p.tenant_id = i.tenant_id
  and not exists (
    select 1 from iga_projects p2
    where p2.tenant_id = i.tenant_id
      and p2.module_key = 'jgf'
      and p2.id <> p.id
  );

update jgf_purchases pu
set project_id = p.id
from iga_projects p
where pu.project_id is null
  and p.module_key = 'jgf'
  and p.tenant_id = pu.tenant_id
  and not exists (
    select 1 from iga_projects p2
    where p2.tenant_id = pu.tenant_id
      and p2.module_key = 'jgf'
      and p2.id <> p.id
  );

update jgf_land_leases ll
set project_id = p.id
from iga_projects p
where ll.project_id is null
  and p.module_key = 'jgf'
  and p.tenant_id = ll.tenant_id
  and not exists (
    select 1 from iga_projects p2
    where p2.tenant_id = ll.tenant_id
      and p2.module_key = 'jgf'
      and p2.id <> p.id
  );

update jgf_crop_cycles cc
set project_id = ll.project_id
from jgf_land_leases ll
where cc.project_id is null
  and cc.lease_id = ll.id;

update jgf_farming_activities fa
set project_id = cc.project_id
from jgf_crop_cycles cc
where fa.project_id is null
  and fa.cycle_id = cc.id;

-- 6) Update unique constraints to scope by project
alter table jpp_batches drop constraint if exists jpp_batches_batch_code_key;
create unique index if not exists uq_jpp_batches_project_code
  on jpp_batches (project_id, batch_code)
  where project_id is not null;

alter table jpp_birds drop constraint if exists jpp_birds_tag_id_key;
create unique index if not exists uq_jpp_birds_project_tag
  on jpp_birds (project_id, tag_id)
  where project_id is not null and tag_id is not null;

create unique index if not exists uq_jgf_batches_project_code
  on jgf_batches (project_id, batch_code)
  where project_id is not null;

-- 7) Set NOT NULL when safely backfilled
do $$
begin
  if not exists (select 1 from jpp_batches where project_id is null) then
    alter table jpp_batches alter column project_id set not null;
  end if;
  if not exists (select 1 from jpp_daily_log where project_id is null) then
    alter table jpp_daily_log alter column project_id set not null;
  end if;
  if not exists (select 1 from jpp_weekly_growth where project_id is null) then
    alter table jpp_weekly_growth alter column project_id set not null;
  end if;
  if not exists (select 1 from jpp_birds where project_id is null) then
    alter table jpp_birds alter column project_id set not null;
  end if;
  if not exists (select 1 from jgf_batches where project_id is null) then
    alter table jgf_batches alter column project_id set not null;
  end if;
  if not exists (select 1 from jgf_production_logs where project_id is null) then
    alter table jgf_production_logs alter column project_id set not null;
  end if;
  if not exists (select 1 from jgf_sales where project_id is null) then
    alter table jgf_sales alter column project_id set not null;
  end if;
  if not exists (select 1 from jgf_expenses where project_id is null) then
    alter table jgf_expenses alter column project_id set not null;
  end if;
end $$;

-- 8) Auto-fill project_id from batch_id where applicable
create or replace function set_jpp_project_from_batch()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is null and new.batch_id is not null then
    select project_id into new.project_id
    from jpp_batches
    where id = new.batch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jpp_daily_project on jpp_daily_log;
create trigger trg_jpp_daily_project
before insert or update on jpp_daily_log
for each row execute function set_jpp_project_from_batch();

drop trigger if exists trg_jpp_weekly_project on jpp_weekly_growth;
create trigger trg_jpp_weekly_project
before insert or update on jpp_weekly_growth
for each row execute function set_jpp_project_from_batch();

drop trigger if exists trg_jpp_birds_project on jpp_birds;
create trigger trg_jpp_birds_project
before insert or update on jpp_birds
for each row execute function set_jpp_project_from_batch();

create or replace function set_jgf_project_from_batch()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is null and new.batch_id is not null then
    select project_id into new.project_id
    from jgf_batches
    where id = new.batch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jgf_logs_project on jgf_production_logs;
create trigger trg_jgf_logs_project
before insert or update on jgf_production_logs
for each row execute function set_jgf_project_from_batch();

drop trigger if exists trg_jgf_sales_project on jgf_sales;
create trigger trg_jgf_sales_project
before insert or update on jgf_sales
for each row execute function set_jgf_project_from_batch();

drop trigger if exists trg_jgf_expenses_project on jgf_expenses;
create trigger trg_jgf_expenses_project
before insert or update on jgf_expenses
for each row execute function set_jgf_project_from_batch();

-- 9) Update KPI views to use project_id (tenant-safe)
drop view if exists v_jpp_batch_kpis;
create view v_jpp_batch_kpis as
with deaths as (
  select batch_id, tenant_id, project_id, coalesce(sum(deaths_today), 0)::bigint as total_deaths
  from jpp_daily_log
  group by batch_id, tenant_id, project_id
),
feed as (
  select batch_id, tenant_id, project_id, coalesce(sum(feed_used_kg), 0)::numeric as total_feed_kg
  from jpp_daily_log
  group by batch_id, tenant_id, project_id
),
spend_daily as (
  select batch_id, tenant_id, project_id, coalesce(sum(money_spent), 0)::numeric as daily_spend
  from jpp_daily_log
  group by batch_id, tenant_id, project_id
),
spend_expenses as (
  select e.batch_id, e.tenant_id, e.project_id, coalesce(sum(e.amount), 0)::numeric as expense_spend
  from project_expenses e
  group by e.batch_id, e.tenant_id, e.project_id
)
select
  b.tenant_id,
  b.project_id,
  b.batch_code,
  b.batch_name,
  b.start_date,
  b.starting_count,
  coalesce(d.total_deaths, 0)::bigint as total_deaths,
  b.starting_count - coalesce(d.total_deaths, 0)::bigint as estimated_alive_now,
  round(
    case
      when b.starting_count = 0 then 0::numeric
      else coalesce(d.total_deaths, 0)::bigint::numeric / b.starting_count::numeric * 100::numeric
    end,
    2
  ) as mortality_pct,
  coalesce(f.total_feed_kg, 0)::numeric as total_feed_kg,
  b.cost_birds + b.cost_transport + b.cost_initial_meds + coalesce(sd.daily_spend, 0)::numeric + coalesce(se.expense_spend, 0)::numeric as total_spend
from jpp_batches b
left join deaths d on d.batch_id = b.id and d.tenant_id = b.tenant_id and d.project_id = b.project_id
left join feed f on f.batch_id = b.id and f.tenant_id = b.tenant_id and f.project_id = b.project_id
left join spend_daily sd on sd.batch_id = b.id and sd.tenant_id = b.tenant_id and sd.project_id = b.project_id
left join spend_expenses se on se.batch_id = b.id and se.tenant_id = b.tenant_id and se.project_id = b.project_id;

drop view if exists jgf_batch_kpis;
create view jgf_batch_kpis as
select
  b.tenant_id,
  b.project_id,
  b.id,
  b.batch_code,
  b.batch_name,
  b.product_type,
  b.status,
  b.start_date,
  b.end_date,
  b.raw_groundnuts_kg,
  b.output_quantity_kg,
  b.output_units,
  b.unit_size_grams,
  coalesce(b.cost_raw_materials, 0::numeric) + coalesce(b.cost_processing, 0::numeric) + coalesce(b.cost_packaging, 0::numeric) + coalesce(b.cost_labour, 0::numeric) as total_batch_cost,
  b.selling_price_per_unit,
  coalesce(sum(s.total_amount), 0::numeric) as total_revenue,
  coalesce(sum(s.quantity_units), 0::bigint) as units_sold,
  b.output_units - coalesce(sum(s.quantity_units), 0::bigint) as units_remaining,
  case
    when b.raw_groundnuts_kg > 0::numeric then round(b.output_quantity_kg / b.raw_groundnuts_kg * 100::numeric, 1)
    else 0::numeric
  end as yield_percentage,
  coalesce(sum(e.amount), 0::numeric) as total_expenses
from jgf_batches b
left join project_sales s on s.batch_id = b.id and s.project_id = b.project_id and s.tenant_id = b.tenant_id
left join project_expenses e on e.batch_id = b.id and e.project_id = b.project_id and e.tenant_id = b.tenant_id
group by
  b.tenant_id,
  b.project_id,
  b.id,
  b.batch_code,
  b.batch_name,
  b.product_type,
  b.status,
  b.start_date,
  b.end_date,
  b.raw_groundnuts_kg,
  b.output_quantity_kg,
  b.output_units,
  b.unit_size_grams,
  b.cost_raw_materials,
  b.cost_processing,
  b.cost_packaging,
  b.cost_labour,
  b.selling_price_per_unit;
