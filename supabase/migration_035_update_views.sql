-- Migration 035: Update views with tenant_id

-- Welfare transactions view with tenant context
drop view if exists welfare_transactions_view;
create view welfare_transactions_view as
select
  wt.id,
  wt.tenant_id,
  wt.cycle_id,
  wt.member_id,
  m.name as recipient,
  wt.date as date_of_issue,
  wt.amount,
  wt.status,
  wt.transaction_type,
  wt.description
from welfare_transactions wt
left join members m on wt.member_id = m.id
order by wt.date desc;

-- JPP batch KPIs view with tenant context
drop view if exists v_jpp_batch_kpis;
create view v_jpp_batch_kpis as
with deaths as (
  select batch_id, tenant_id, coalesce(sum(deaths_today), 0)::bigint as total_deaths
  from jpp_daily_log
  group by batch_id, tenant_id
),
feed as (
  select batch_id, tenant_id, coalesce(sum(feed_used_kg), 0)::numeric as total_feed_kg
  from jpp_daily_log
  group by batch_id, tenant_id
),
spend_daily as (
  select batch_id, tenant_id, coalesce(sum(money_spent), 0)::numeric as daily_spend
  from jpp_daily_log
  group by batch_id, tenant_id
),
spend_expenses as (
  select e.batch_id, e.tenant_id, coalesce(sum(e.amount), 0)::numeric as expense_spend
  from project_expenses e
  join iga_projects p on p.id = e.project_id and p.code::text = 'JPP'::text and p.tenant_id = e.tenant_id
  group by e.batch_id, e.tenant_id
)
select
  b.tenant_id,
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
left join deaths d on d.batch_id = b.id and d.tenant_id = b.tenant_id
left join feed f on f.batch_id = b.id and f.tenant_id = b.tenant_id
left join spend_daily sd on sd.batch_id = b.id and sd.tenant_id = b.tenant_id
left join spend_expenses se on se.batch_id = b.id and se.tenant_id = b.tenant_id;

-- JGF batch KPIs view with tenant context
drop view if exists jgf_batch_kpis;
create view jgf_batch_kpis as
select
  b.tenant_id,
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
left join iga_projects p on p.code::text = 'JGF'::text and p.tenant_id = b.tenant_id
left join project_sales s on s.batch_id = b.id and s.project_id = p.id and s.tenant_id = b.tenant_id
left join project_expenses e on e.batch_id = b.id and e.project_id = p.id and e.tenant_id = b.tenant_id
group by
  b.tenant_id,
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
