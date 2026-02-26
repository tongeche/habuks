                                                                  -- Migration 054: Activity option values catalog + finance metadata fields
                                                                  -- Goals:
                                                                  -- 1) Store category/value-type/budget-line options in DB (global + tenant overrides).
                                                                  -- 2) Keep hardcoded fallback possible in app if table is unavailable.
                                                                  -- 3) Persist selected value_type and budget_line on meetings.

                                                                  create extension if not exists pgcrypto;

                                                                  alter table public.meetings
                                                                    add column if not exists value_type text,
                                                                    add column if not exists budget_line text,
                                                                    add column if not exists source_partner_id text,
                                                                    add column if not exists source_partner_name text,
                                                                    add column if not exists poster_url text,
                                                                    add column if not exists poster_path text;

                                                                  comment on column public.meetings.value_type is 'Finance value type for an activity (for example Income, Expense).';
                                                                  comment on column public.meetings.budget_line is 'Budget line classification for an activity (for example Operations, Welfare).';
                                                                  comment on column public.meetings.source_partner_id is 'Partner id selected as the activity finance source.';
                                                                  comment on column public.meetings.source_partner_name is 'Partner name snapshot selected as the activity finance source.';
                                                                  comment on column public.meetings.poster_url is 'Public URL of the uploaded activity poster image.';
                                                                  comment on column public.meetings.poster_path is 'Storage path of uploaded activity poster image.';

                                                                  create table if not exists public.organization_activity_option_values (
                                                                    id uuid primary key default gen_random_uuid(),
                                                                    tenant_id uuid references public.tenants(id) on delete cascade,
                                                                    option_group text not null,
                                                                    option_value text not null,
                                                                    option_label text not null,
                                                                    display_order integer not null default 0,
                                                                    is_active boolean not null default true,
                                                                    created_at timestamptz not null default now(),
                                                                    updated_at timestamptz not null default now()
                                                                  );

                                                                  alter table public.organization_activity_option_values
                                                                    drop constraint if exists organization_activity_option_values_group_chk;

                                                                  alter table public.organization_activity_option_values
                                                                    add constraint organization_activity_option_values_group_chk
                                                                    check (option_group in ('category', 'value_type', 'budget_line'));

                                                                  alter table public.organization_activity_option_values
                                                                    drop constraint if exists organization_activity_option_values_value_not_blank_chk;

                                                                  alter table public.organization_activity_option_values
                                                                    add constraint organization_activity_option_values_value_not_blank_chk
                                                                    check (length(btrim(option_value)) > 0);

                                                                  alter table public.organization_activity_option_values
                                                                    drop constraint if exists organization_activity_option_values_label_not_blank_chk;

                                                                  alter table public.organization_activity_option_values
                                                                    add constraint organization_activity_option_values_label_not_blank_chk
                                                                    check (length(btrim(option_label)) > 0);

                                                                  create index if not exists organization_activity_option_values_tenant_idx
                                                                    on public.organization_activity_option_values (tenant_id);

                                                                  create index if not exists organization_activity_option_values_group_idx
                                                                    on public.organization_activity_option_values (option_group, is_active, display_order);

                                                                  create unique index if not exists organization_activity_option_values_global_uq
                                                                    on public.organization_activity_option_values (option_group, lower(btrim(option_value)))
                                                                    where tenant_id is null;

                                                                  create unique index if not exists organization_activity_option_values_tenant_uq
                                                                    on public.organization_activity_option_values (tenant_id, option_group, lower(btrim(option_value)))
                                                                    where tenant_id is not null;

                                                                  create or replace function public.touch_organization_activity_option_values_updated_at()
                                                                  returns trigger
                                                                  language plpgsql
                                                                  as $$
                                                                  begin
                                                                    new.updated_at := now();
                                                                    return new;
                                                                  end;
                                                                  $$;

                                                                  drop trigger if exists trg_org_activity_option_values_touch_updated_at
                                                                    on public.organization_activity_option_values;

                                                                  create trigger trg_org_activity_option_values_touch_updated_at
                                                                  before update on public.organization_activity_option_values
                                                                  for each row execute function public.touch_organization_activity_option_values_updated_at();

                                                                  alter table public.organization_activity_option_values enable row level security;

                                                                  drop policy if exists "Authenticated can view activity option values"
                                                                    on public.organization_activity_option_values;

                                                                  create policy "Authenticated can view activity option values"
                                                                  on public.organization_activity_option_values
                                                                  for select
                                                                  to authenticated
                                                                  using (
                                                                    tenant_id is null
                                                                    or public.can_access_organization_activity(tenant_id)
                                                                  );

                                                                  drop policy if exists "Tenant admins can manage activity option values"
                                                                    on public.organization_activity_option_values;

                                                                  create policy "Tenant admins can manage activity option values"
                                                                  on public.organization_activity_option_values
                                                                  for all
                                                                  to authenticated
                                                                  using (
                                                                    tenant_id is not null
                                                                    and public.can_manage_organization_activity(tenant_id)
                                                                  )
                                                                  with check (
                                                                    tenant_id is not null
                                                                    and public.can_manage_organization_activity(tenant_id)
                                                                  );

                                                                  insert into public.organization_activity_option_values
                                                                    (tenant_id, option_group, option_value, option_label, display_order, is_active)
                                                                  values
                                                                    (null, 'category', 'General', 'General', 0, true),
                                                                    (null, 'category', 'Sales', 'Sales', 1, true),
                                                                    (null, 'category', 'Expenses', 'Expenses', 2, true),
                                                                    (null, 'category', 'Welfare', 'Welfare', 3, true),
                                                                    (null, 'category', 'Report', 'Report', 4, true),

                                                                    (null, 'value_type', 'Income', 'Income', 0, true),
                                                                    (null, 'value_type', 'Expense', 'Expense', 1, true),
                                                                    (null, 'value_type', 'Contribution', 'Contribution', 2, true),

                                                                    (null, 'budget_line', 'Operations', 'Operations', 0, true),
                                                                    (null, 'budget_line', 'Welfare', 'Welfare', 1, true),
                                                                    (null, 'budget_line', 'Projects', 'Projects', 2, true),
                                                                    (null, 'budget_line', 'Administration', 'Administration', 3, true)
                                                                  on conflict do nothing;
