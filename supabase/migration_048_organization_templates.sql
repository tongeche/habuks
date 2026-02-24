-- Migration 048: Organization template library metadata + storage access policies
-- Goals:
-- 1) Create tenant-aware organization_templates table for template metadata.
-- 2) Enforce RLS for read/manage by tenant membership and roles.
-- 3) Add private storage bucket + tenant/global path policies for template files.
-- 4) Seed baseline global template records (metadata only; file upload happens separately).

create extension if not exists pgcrypto;

create table if not exists public.organization_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  category text not null default 'General Templates',
  format text,
  description text,
  sections jsonb,
  file_path text,
  mime_type text,
  file_ext text,
  file_size_bytes bigint,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by_member_id integer references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_templates
  drop constraint if exists organization_templates_name_not_blank_chk;
alter table public.organization_templates
  add constraint organization_templates_name_not_blank_chk
  check (length(btrim(name)) > 0);

alter table public.organization_templates
  drop constraint if exists organization_templates_category_not_blank_chk;
alter table public.organization_templates
  add constraint organization_templates_category_not_blank_chk
  check (length(btrim(category)) > 0);

alter table public.organization_templates
  drop constraint if exists organization_templates_file_size_non_negative_chk;
alter table public.organization_templates
  add constraint organization_templates_file_size_non_negative_chk
  check (file_size_bytes is null or file_size_bytes >= 0);

create index if not exists organization_templates_tenant_idx
  on public.organization_templates (tenant_id);
create index if not exists organization_templates_active_sort_idx
  on public.organization_templates (is_active, sort_order, name);

create or replace function public.touch_organization_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_organization_templates_touch_updated_at on public.organization_templates;
create trigger trg_organization_templates_touch_updated_at
before update on public.organization_templates
for each row execute function public.touch_organization_templates_updated_at();

create or replace function public.can_access_organization_template(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    case
      when p_tenant_id is null then true
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

create or replace function public.can_manage_organization_template(p_tenant_id uuid)
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

grant execute on function public.can_access_organization_template(uuid) to authenticated;
grant execute on function public.can_manage_organization_template(uuid) to authenticated;

alter table public.organization_templates enable row level security;

drop policy if exists "Authenticated can view organization templates" on public.organization_templates;
create policy "Authenticated can view organization templates"
on public.organization_templates
for select
to authenticated
using (public.can_access_organization_template(tenant_id));

drop policy if exists "Tenant admins can manage organization templates" on public.organization_templates;
create policy "Tenant admins can manage organization templates"
on public.organization_templates
for all
to authenticated
using (public.can_manage_organization_template(tenant_id))
with check (public.can_manage_organization_template(tenant_id));

insert into storage.buckets (id, name, public)
values ('organization-templates', 'organization-templates', false)
on conflict (id) do update set public = excluded.public;

do $$
begin
  begin
    alter table storage.objects enable row level security;
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

create or replace function public.can_access_organization_templates_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    split_part(coalesce(object_name, ''), '/', 1) = 'global'
    or (
      split_part(coalesce(object_name, ''), '/', 1) = 'tenants'
      and nullif(split_part(object_name, '/', 2), '') is not null
      and exists (
        select 1
        from public.members m
        left join public.tenant_members tm
          on tm.member_id = m.id
         and tm.status = 'active'
        where m.auth_id = auth.uid()
          and (
            m.role in ('admin', 'superadmin', 'project_manager')
            or tm.tenant_id::text = split_part(object_name, '/', 2)
          )
      )
    );
$$;

grant execute on function public.can_access_organization_templates_path(text) to authenticated;

drop policy if exists "Authenticated read organization templates paths" on storage.objects;
create policy "Authenticated read organization templates paths"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organization-templates'
  and public.can_access_organization_templates_path(name)
);

drop policy if exists "Authenticated insert organization templates tenant paths" on storage.objects;
create policy "Authenticated insert organization templates tenant paths"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-templates'
  and split_part(name, '/', 1) = 'tenants'
  and public.can_access_organization_templates_path(name)
);

drop policy if exists "Authenticated update organization templates tenant paths" on storage.objects;
create policy "Authenticated update organization templates tenant paths"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'organization-templates'
  and split_part(name, '/', 1) = 'tenants'
  and public.can_access_organization_templates_path(name)
)
with check (
  bucket_id = 'organization-templates'
  and split_part(name, '/', 1) = 'tenants'
  and public.can_access_organization_templates_path(name)
);

drop policy if exists "Authenticated delete organization templates tenant paths" on storage.objects;
create policy "Authenticated delete organization templates tenant paths"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-templates'
  and split_part(name, '/', 1) = 'tenants'
  and public.can_access_organization_templates_path(name)
);

insert into public.organization_templates (
  template_key,
  tenant_id,
  name,
  category,
  format,
  description,
  sections,
  is_active,
  sort_order
)
values
  (
    'meeting-minutes-template',
    null,
    'Meeting Minutes Template',
    'Governance Templates',
    'DOCX',
    'Record meeting agenda, decisions, and action owners.',
    '["Meeting date and location","Members present","Decisions made","Action points and deadlines","Next meeting date"]'::jsonb,
    true,
    10
  ),
  (
    'activity-work-plan-template',
    null,
    'Activity Plan & Work Plan',
    'Project Planning Templates',
    'DOCX',
    'Convert plans into sequenced activities and responsibilities.',
    '["Project name and objectives","Key activities and timeline","Responsible person","Budget estimate"]'::jsonb,
    true,
    20
  ),
  (
    'budget-expense-tracker-template',
    null,
    'Budget & Expense Tracker',
    'Financial Templates',
    'XLSX',
    'Track planned budget, actual spend, and variance.',
    '["Budget plan sheet","Actual spending sheet","Variance by category","Summary totals"]'::jsonb,
    true,
    30
  ),
  (
    'monthly-financial-report-template',
    null,
    'Monthly Financial Report Template',
    'Reporting Templates',
    'DOCX',
    'Share transparent monthly financial updates with members.',
    '["Opening balance","Contributions and expenses","Closing balance","Major expense summary","Attachments list"]'::jsonb,
    true,
    40
  ),
  (
    'project-presentation-template',
    null,
    'Project Presentation Template',
    'Project Planning Templates',
    'PPTX',
    'Present project value clearly to partners and donors.',
    '["Project background","Problem and response","Budget summary","Impact or results","Photo highlights"]'::jsonb,
    true,
    50
  ),
  (
    'partner-donor-register-template',
    null,
    'Partner & Donor Register',
    'Governance Templates',
    'XLSX',
    'Track contacts, commitments, and follow-up status.',
    '["Organization contact details","Engagement status","Commitments and next steps","Last contact date"]'::jsonb,
    true,
    60
  ),
  (
    'member-attendance-register-template',
    null,
    'Member Attendance Register',
    'Governance Templates',
    'XLSX',
    'Maintain signed attendance records for meetings and activities.',
    '["Meeting or activity details","Member names","Attendance status","Signature or remarks"]'::jsonb,
    true,
    70
  ),
  (
    'procurement-request-template',
    null,
    'Procurement Request Form',
    'Financial Templates',
    'DOCX',
    'Standardize purchase requests and approvals before spending.',
    '["Requesting unit and item","Quantity and expected cost","Justification","Approval workflow"]'::jsonb,
    true,
    80
  )
on conflict (template_key)
do update
set
  name = excluded.name,
  category = excluded.category,
  format = excluded.format,
  description = excluded.description,
  sections = excluded.sections,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
