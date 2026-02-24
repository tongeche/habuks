-- Migration 034: Add tenant_id to core data tables

alter table blogs add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists blogs_tenant_idx on blogs (tenant_id);

alter table contributions add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists contributions_tenant_idx on contributions (tenant_id);

alter table contribution_splits add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists contribution_splits_tenant_idx on contribution_splits (tenant_id);

alter table documents add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists documents_tenant_idx on documents (tenant_id);

alter table iga_projects add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_projects_tenant_idx on iga_projects (tenant_id);

alter table iga_committee_members add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists iga_committee_members_tenant_idx on iga_committee_members (tenant_id);

alter table project_activities add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_activities_tenant_idx on project_activities (tenant_id);

alter table project_donation_items add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_donation_items_tenant_idx on project_donation_items (tenant_id);

alter table project_expense_items add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_expense_items_tenant_idx on project_expense_items (tenant_id);

alter table project_expenses add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_expenses_tenant_idx on project_expenses (tenant_id);

alter table project_faq add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_faq_tenant_idx on project_faq (tenant_id);

alter table project_gallery add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_gallery_tenant_idx on project_gallery (tenant_id);

alter table project_goals add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_goals_tenant_idx on project_goals (tenant_id);

alter table project_products add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_products_tenant_idx on project_products (tenant_id);

alter table project_sales add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_sales_tenant_idx on project_sales (tenant_id);

alter table project_volunteer_roles add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists project_volunteer_roles_tenant_idx on project_volunteer_roles (tenant_id);

alter table jpp_batches add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jpp_batches_tenant_idx on jpp_batches (tenant_id);

alter table jpp_birds add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jpp_birds_tenant_idx on jpp_birds (tenant_id);

alter table jpp_daily_log add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jpp_daily_log_tenant_idx on jpp_daily_log (tenant_id);

alter table jpp_weekly_growth add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jpp_weekly_growth_tenant_idx on jpp_weekly_growth (tenant_id);

alter table jgf_batches add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_batches_tenant_idx on jgf_batches (tenant_id);

alter table jgf_crop_cycles add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_crop_cycles_tenant_idx on jgf_crop_cycles (tenant_id);

alter table jgf_farming_activities add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_farming_activities_tenant_idx on jgf_farming_activities (tenant_id);

alter table jgf_inventory add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_inventory_tenant_idx on jgf_inventory (tenant_id);

alter table jgf_land_leases add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_land_leases_tenant_idx on jgf_land_leases (tenant_id);

alter table jgf_production_logs add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_production_logs_tenant_idx on jgf_production_logs (tenant_id);

alter table jgf_purchases add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists jgf_purchases_tenant_idx on jgf_purchases (tenant_id);

alter table meetings add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists meetings_tenant_idx on meetings (tenant_id);

alter table payouts add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists payouts_tenant_idx on payouts (tenant_id);

alter table welfare_accounts add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists welfare_accounts_tenant_idx on welfare_accounts (tenant_id);

alter table welfare_balances add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists welfare_balances_tenant_idx on welfare_balances (tenant_id);

alter table welfare_cycles add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists welfare_cycles_tenant_idx on welfare_cycles (tenant_id);

alter table welfare_transactions add column if not exists tenant_id uuid references tenants(id) on delete cascade;
create index if not exists welfare_transactions_tenant_idx on welfare_transactions (tenant_id);

-- Update unique constraint to allow per-tenant project codes
alter table iga_projects drop constraint if exists iga_projects_code_key;
create unique index if not exists iga_projects_tenant_code_idx on iga_projects (tenant_id, code);
