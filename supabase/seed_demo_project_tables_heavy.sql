-- Deterministic heavy-load demo seed for project-facing tables.
-- Use this to stress-test project dashboards, filters, charts, and donor report views.
-- Run after supabase/seed_demo.sql.

begin;

do $$
declare
  v_tenant_id uuid;
  v_jpp_project_id integer;
  v_jgf_project_id integer;
  v_admin_member_id integer;
  v_treasurer_id integer;
  v_secretary_id integer;
  v_jpp_batch_id uuid;
  v_jgf_batch_id uuid;
begin
  select id into v_tenant_id
  from public.tenants
  where slug = 'habuks-demo'
  limit 1;

  if v_tenant_id is null then
    raise exception 'Demo tenant not found. Run supabase/seed_demo.sql first.';
  end if;

  select id into v_jpp_project_id
  from public.iga_projects
  where tenant_id = v_tenant_id and code = 'JPP'
  limit 1;

  select id into v_jgf_project_id
  from public.iga_projects
  where tenant_id = v_tenant_id and code = 'JGF'
  limit 1;

  if v_jpp_project_id is null or v_jgf_project_id is null then
    raise exception 'Demo projects JPP/JGF are missing for tenant %', v_tenant_id;
  end if;

  select id into v_admin_member_id
  from public.members
  where lower(email) = lower('demo.member@habuks.com')
  limit 1;

  select id into v_treasurer_id
  from public.members
  where lower(email) = lower('demo.treasurer@habuks.com')
  limit 1;

  select id into v_secretary_id
  from public.members
  where lower(email) = lower('demo.secretary@habuks.com')
  limit 1;

  select id into v_jpp_batch_id
  from public.jpp_batches
  where tenant_id = v_tenant_id
  order by start_date desc nulls last
  limit 1;

  select id into v_jgf_batch_id
  from public.jgf_batches
  where tenant_id = v_tenant_id
  order by start_date desc nulls last
  limit 1;

  -- Reset deterministic project-facing data for heavy demo mode.
  delete from public.project_tasks
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_notes
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_documents
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_gallery
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.iga_budgets
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_expense_categories
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_expenses
  where project_id in (v_jpp_project_id, v_jgf_project_id);

  -- Categories.
  insert into public.project_expense_categories (project_id, name, display_order)
  values
    (v_jpp_project_id, 'Feed', 0),
    (v_jpp_project_id, 'Meds', 1),
    (v_jpp_project_id, 'Utilities', 2),
    (v_jpp_project_id, 'Transport', 3),
    (v_jpp_project_id, 'Equipment', 4),
    (v_jpp_project_id, 'Labor', 5),
    (v_jgf_project_id, 'Raw Materials', 0),
    (v_jgf_project_id, 'Packaging', 1),
    (v_jgf_project_id, 'Transport', 2),
    (v_jgf_project_id, 'Operations', 3),
    (v_jgf_project_id, 'Marketing', 4),
    (v_jgf_project_id, 'Utilities', 5);

  -- Budget and funding cards.
  insert into public.iga_budgets (
    project_id,
    item,
    planned_amount,
    actual_amount,
    date,
    notes,
    tenant_id
  )
  values
    (
      v_jpp_project_id,
      'Total budget',
      980000,
      536400,
      current_date - interval '80 days',
      'Heavy-load seed budget for poultry production, brooder utilities, and market prep.',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      'Expected revenue',
      1245000,
      602800,
      current_date - interval '80 days',
      'Projected from eggs, growers, and mature bird sales.',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      'Budget plan details',
      null,
      null,
      current_date - interval '80 days',
      E'Funding source: mixed\nPayout schedule: monthly\nNotes: Maintain working-capital buffer for feed procurement and cold-chain transport.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Total budget',
      1120000,
      648300,
      current_date - interval '80 days',
      'Heavy-load seed budget for processing, packaging, QA, and distribution.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Expected revenue',
      1620000,
      791200,
      current_date - interval '80 days',
      'Projected from retail, wholesale, and distributor channels.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Budget plan details',
      null,
      null,
      current_date - interval '80 days',
      E'Funding source: mixed\nPayout schedule: monthly\nNotes: Increase production cycle throughput while preserving quality checks.',
      v_tenant_id
    );

  -- Heavy expense rows: JPP (60 rows)
  insert into public.project_expenses (
    project_id,
    batch_id,
    expense_date,
    category,
    amount,
    vendor,
    description,
    receipt,
    payment_reference,
    receipt_file_path,
    receipt_file_url,
    receipt_mime_type,
    receipt_file_size_bytes,
    receipt_uploaded_at,
    tenant_id
  )
  select
    v_jpp_project_id,
    v_jpp_batch_id,
    (current_date - (190 - (g * 3)))::date as expense_date,
    case (g % 8)
      when 0 then 'Feed'
      when 1 then 'Meds'
      when 2 then 'Utilities'
      when 3 then 'Transport'
      when 4 then 'Equipment'
      when 5 then 'Labor'
      when 6 then 'Feed'
      else 'Utilities'
    end as category,
    (2200 + ((g * 431) % 10800))::numeric(12,2) as amount,
    case (g % 8)
      when 0 then 'Kosele Feeds'
      when 1 then 'AgroVet Homa Bay'
      when 2 then 'KPLC'
      when 3 then 'Boda Logistics'
      when 4 then 'Farm Equip Hub'
      when 5 then 'Community Labor Team'
      when 6 then 'Kosele Feeds'
      else 'KPLC'
    end as vendor,
    'JPP demo expense row #' || lpad(g::text, 3, '0') || ' for load testing dashboards and reports.' as description,
    (g % 5) <> 0 as receipt,
    case
      when (g % 5) <> 0 then 'MPESA-JPP-' || lpad(g::text, 4, '0')
      else null
    end as payment_reference,
    case
      when (g % 5) <> 0
        then 'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/receipts/jpp-heavy-' || g || '.pdf'
      else null
    end as receipt_file_path,
    case
      when (g % 5) <> 0 then '/assets/MINUTES JONGOI.pdf'
      else null
    end as receipt_file_url,
    case
      when (g % 5) <> 0 then 'application/pdf'
      else null
    end as receipt_mime_type,
    case
      when (g % 5) <> 0 then 128000 + (g * 117)
      else null
    end as receipt_file_size_bytes,
    case
      when (g % 5) <> 0 then now() - make_interval(days => (210 - (g * 3)))
      else null
    end as receipt_uploaded_at,
    v_tenant_id
  from generate_series(1, 60) as g;

  -- Heavy expense rows: JGF (64 rows)
  insert into public.project_expenses (
    project_id,
    batch_id,
    expense_date,
    category,
    amount,
    vendor,
    description,
    receipt,
    payment_reference,
    receipt_file_path,
    receipt_file_url,
    receipt_mime_type,
    receipt_file_size_bytes,
    receipt_uploaded_at,
    tenant_id
  )
  select
    v_jgf_project_id,
    v_jgf_batch_id,
    (current_date - (170 - (g * 2)))::date as expense_date,
    case (g % 8)
      when 0 then 'Raw Materials'
      when 1 then 'Packaging'
      when 2 then 'Transport'
      when 3 then 'Operations'
      when 4 then 'Marketing'
      when 5 then 'Utilities'
      when 6 then 'Raw Materials'
      else 'Packaging'
    end as category,
    (2600 + ((g * 389) % 12400))::numeric(12,2) as amount,
    case (g % 8)
      when 0 then 'Kosele Farmers Coop'
      when 1 then 'Lake Labels'
      when 2 then 'Boda Logistics'
      when 3 then 'Operations Supply Hub'
      when 4 then 'Market Activation Team'
      when 5 then 'County Utilities'
      when 6 then 'Local Farmers'
      else 'Lake Labels'
    end as vendor,
    'JGF demo expense row #' || lpad(g::text, 3, '0') || ' for load testing dashboards and reports.' as description,
    (g % 6) <> 0 as receipt,
    case
      when (g % 6) <> 0 then 'MPESA-JGF-' || lpad(g::text, 4, '0')
      else null
    end as payment_reference,
    case
      when (g % 6) <> 0
        then 'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/receipts/jgf-heavy-' || g || '.pdf'
      else null
    end as receipt_file_path,
    case
      when (g % 6) <> 0 then '/assets/MINUTES JONGOI.pdf'
      else null
    end as receipt_file_url,
    case
      when (g % 6) <> 0 then 'application/pdf'
      else null
    end as receipt_mime_type,
    case
      when (g % 6) <> 0 then 133000 + (g * 129)
      else null
    end as receipt_file_size_bytes,
    case
      when (g % 6) <> 0 then now() - make_interval(days => (182 - (g * 2)))
      else null
    end as receipt_uploaded_at,
    v_tenant_id
  from generate_series(1, 64) as g;

  -- Heavy task load: JPP (28 rows)
  insert into public.project_tasks (
    project_id,
    title,
    details,
    assignee_member_id,
    due_date,
    priority,
    status,
    created_by_member_id,
    completed_at
  )
  select
    v_jpp_project_id,
    'JPP milestone #' || lpad(g::text, 2, '0'),
    'Execution checkpoint for poultry operations and market readiness (seeded heavy dataset).',
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_treasurer_id
      else v_secretary_id
    end as assignee_member_id,
    (current_date + (g - 14))::date as due_date,
    case (g % 4)
      when 0 then 'urgent'
      when 1 then 'high'
      else 'normal'
    end as priority,
    case
      when (g % 9) = 0 then 'cancelled'
      when (g % 5) = 0 then 'done'
      when (g % 3) = 0 then 'in_progress'
      else 'open'
    end as status,
    v_admin_member_id,
    case
      when (g % 5) = 0 then now() - make_interval(days => ((g % 35) + 1))
      else null
    end as completed_at
  from generate_series(1, 28) as g;

  -- Heavy task load: JGF (30 rows)
  insert into public.project_tasks (
    project_id,
    title,
    details,
    assignee_member_id,
    due_date,
    priority,
    status,
    created_by_member_id,
    completed_at
  )
  select
    v_jgf_project_id,
    'JGF milestone #' || lpad(g::text, 2, '0'),
    'Execution checkpoint for processing, packaging, and distribution (seeded heavy dataset).',
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_secretary_id
      else v_treasurer_id
    end as assignee_member_id,
    (current_date + (g - 11))::date as due_date,
    case (g % 4)
      when 0 then 'urgent'
      when 1 then 'high'
      else 'normal'
    end as priority,
    case
      when (g % 10) = 0 then 'cancelled'
      when (g % 4) = 0 then 'done'
      when (g % 3) = 0 then 'in_progress'
      else 'open'
    end as status,
    v_admin_member_id,
    case
      when (g % 4) = 0 then now() - make_interval(days => ((g % 28) + 1))
      else null
    end as completed_at
  from generate_series(1, 30) as g;

  -- Heavy notes: JPP (14 rows)
  insert into public.project_notes (
    project_id,
    title,
    body,
    visibility,
    author_member_id,
    pinned
  )
  select
    v_jpp_project_id,
    'JPP note #' || lpad(g::text, 2, '0'),
    'Seeded note entry for project communication, audit trail, and donor reporting context.',
    case when (g % 4) = 0 then 'admins_only' else 'project_team' end,
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_secretary_id
      else v_treasurer_id
    end as author_member_id,
    (g % 6) = 0 as pinned
  from generate_series(1, 14) as g;

  -- Heavy notes: JGF (16 rows)
  insert into public.project_notes (
    project_id,
    title,
    body,
    visibility,
    author_member_id,
    pinned
  )
  select
    v_jgf_project_id,
    'JGF note #' || lpad(g::text, 2, '0'),
    'Seeded note entry for operations, quality updates, and external reporting references.',
    case when (g % 5) = 0 then 'admins_only' else 'project_team' end,
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_treasurer_id
      else v_secretary_id
    end as author_member_id,
    (g % 7) = 0 as pinned
  from generate_series(1, 16) as g;

  -- Heavy documents: JPP (10 rows)
  insert into public.project_documents (
    project_id,
    name,
    file_path,
    file_url,
    mime_type,
    file_ext,
    file_size_bytes,
    uploaded_by_member_id,
    uploaded_at
  )
  select
    v_jpp_project_id,
    'JPP donor packet doc #' || lpad(g::text, 2, '0'),
    'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/documents/jpp-heavy-doc-' || lpad(g::text, 2, '0') || '.pdf',
    '/assets/MINUTES JONGOI.pdf',
    'application/pdf',
    'pdf',
    180000 + (g * 1432),
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_secretary_id
      else v_treasurer_id
    end as uploaded_by_member_id,
    now() - make_interval(days => (g * 3))
  from generate_series(1, 10) as g;

  -- Heavy documents: JGF (12 rows)
  insert into public.project_documents (
    project_id,
    name,
    file_path,
    file_url,
    mime_type,
    file_ext,
    file_size_bytes,
    uploaded_by_member_id,
    uploaded_at
  )
  select
    v_jgf_project_id,
    'JGF donor packet doc #' || lpad(g::text, 2, '0'),
    'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/documents/jgf-heavy-doc-' || lpad(g::text, 2, '0') || '.pdf',
    '/assets/MINUTES JONGOI.pdf',
    'application/pdf',
    'pdf',
    190000 + (g * 1520),
    case (g % 3)
      when 0 then v_admin_member_id
      when 1 then v_treasurer_id
      else v_secretary_id
    end as uploaded_by_member_id,
    now() - make_interval(days => (g * 2))
  from generate_series(1, 12) as g;

  -- Gallery media.
  insert into public.project_gallery (
    project_id,
    image_url,
    caption,
    is_primary,
    display_order,
    tenant_id
  )
  values
    (v_jpp_project_id, '/assets/data-metric.png', 'JPP dashboard overview.', true, 0, v_tenant_id),
    (v_jpp_project_id, '/assets/automated-tracking.png', 'JPP tasks and automation tracking.', false, 1, v_tenant_id),
    (v_jpp_project_id, '/assets/update-audit.png', 'JPP compliance and audit highlights.', false, 2, v_tenant_id),
    (v_jpp_project_id, '/assets/metrics.png', 'JPP financial analytics snapshot.', false, 3, v_tenant_id),
    (v_jpp_project_id, '/assets/highlight-saas.png', 'JPP partner-facing showcase visual.', false, 4, v_tenant_id),
    (v_jpp_project_id, '/assets/tenants-user.png', 'JPP member collaboration panel.', false, 5, v_tenant_id),
    (v_jgf_project_id, '/assets/metrics.png', 'JGF dashboard overview.', true, 0, v_tenant_id),
    (v_jgf_project_id, '/assets/highlight-saas.png', 'JGF operations and capacity highlights.', false, 1, v_tenant_id),
    (v_jgf_project_id, '/assets/tenants-user.png', 'JGF member coordination panel.', false, 2, v_tenant_id),
    (v_jgf_project_id, '/assets/data-metric.png', 'JGF finance and report analytics.', false, 3, v_tenant_id),
    (v_jgf_project_id, '/assets/automated-tracking.png', 'JGF task and milestone monitoring.', false, 4, v_tenant_id),
    (v_jgf_project_id, '/assets/update-audit.png', 'JGF audit readiness snapshot.', false, 5, v_tenant_id);

  -- Partner records for traction sections.
  update public.tenants
  set site_data = jsonb_set(
    jsonb_set(
      coalesce(site_data, '{}'::jsonb),
      '{organization_profile}',
      coalesce(site_data->'organization_profile', '{}'::jsonb),
      true
    ),
    '{organization_profile,partners}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'demo-partner-county',
        'name', 'Homa Bay County Agriculture Office',
        'kind', 'Government',
        'status', 'Active',
        'contact_person', 'County Extension Officer',
        'contact_email', 'agriculture@homabay.go.ke',
        'contact_phone', '+254700100221',
        'last_contact', to_char(current_date - interval '10 days', 'YYYY-MM-DD'),
        'notes', 'Supports extension services and field validation.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jpp_project_id::text, v_jgf_project_id::text)
      ),
      jsonb_build_object(
        'id', 'demo-partner-coop',
        'name', 'Kosele Farmer Cooperative',
        'kind', 'Supplier',
        'status', 'Active',
        'contact_person', 'Procurement Desk',
        'contact_email', 'procurement@koselecoop.org',
        'contact_phone', '+254700100331',
        'last_contact', to_char(current_date - interval '7 days', 'YYYY-MM-DD'),
        'notes', 'Provides input procurement support for both modules.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jpp_project_id::text, v_jgf_project_id::text)
      ),
      jsonb_build_object(
        'id', 'demo-partner-foundation',
        'name', 'Lake Region Enterprise Foundation',
        'kind', 'Funder',
        'status', 'Pipeline',
        'contact_person', 'Partnerships Lead',
        'contact_email', 'partnerships@lakefoundation.org',
        'contact_phone', '+254700100441',
        'last_contact', to_char(current_date - interval '4 days', 'YYYY-MM-DD'),
        'notes', 'Reviewing co-funding proposal for working capital and market access.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jgf_project_id::text)
      ),
      jsonb_build_object(
        'id', 'demo-partner-retail',
        'name', 'Blue Lake Retail Network',
        'kind', 'Distributor',
        'status', 'Active',
        'contact_person', 'Category Buyer',
        'contact_email', 'buyer@bluelake-retail.co.ke',
        'contact_phone', '+254700100551',
        'last_contact', to_char(current_date - interval '6 days', 'YYYY-MM-DD'),
        'notes', 'Supports packaged product placement and rotation reports.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jgf_project_id::text)
      ),
      jsonb_build_object(
        'id', 'demo-partner-logistics',
        'name', 'South Nyanza Logistics Cluster',
        'kind', 'Logistics',
        'status', 'Active',
        'contact_person', 'Route Coordinator',
        'contact_email', 'dispatch@southnyanzalogistics.co.ke',
        'contact_phone', '+254700100661',
        'last_contact', to_char(current_date - interval '9 days', 'YYYY-MM-DD'),
        'notes', 'Provides transport scheduling for procurement and distribution cycles.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jpp_project_id::text, v_jgf_project_id::text)
      ),
      jsonb_build_object(
        'id', 'demo-partner-skills',
        'name', 'Youth Enterprise Skills Hub',
        'kind', 'Capacity Building',
        'status', 'Active',
        'contact_person', 'Training Coordinator',
        'contact_email', 'training@youthskillshub.or.ke',
        'contact_phone', '+254700100771',
        'last_contact', to_char(current_date - interval '5 days', 'YYYY-MM-DD'),
        'notes', 'Delivers practical training for production quality and record-keeping.',
        'logo_url', '/assets/logo.png',
        'linked_project_ids', jsonb_build_array(v_jpp_project_id::text)
      )
    ),
    true
  )
  where id = v_tenant_id;
end $$;

commit;
