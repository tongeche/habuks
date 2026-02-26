-- Deterministic project-table overseed for the habuks-demo tenant.
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

  -- Reset project-facing tables for deterministic demo output.
  delete from public.project_tasks
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_notes
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_documents
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_gallery
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.iga_budgets
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_expense_categories
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  delete from public.project_expenses
  where tenant_id = v_tenant_id
    and project_id in (v_jpp_project_id, v_jgf_project_id);

  -- Expense categories (Projects tab).
  insert into public.project_expense_categories (project_id, name, display_order)
  values
    (v_jpp_project_id, 'Feed', 0),
    (v_jpp_project_id, 'Meds', 1),
    (v_jpp_project_id, 'Utilities', 2),
    (v_jpp_project_id, 'Transport', 3),
    (v_jgf_project_id, 'Raw Materials', 0),
    (v_jgf_project_id, 'Packaging', 1),
    (v_jgf_project_id, 'Transport', 2),
    (v_jgf_project_id, 'Operations', 3);

  -- Budget + finance cards.
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
      280000,
      143500,
      '2026-02-01',
      'Prepared for Q1/Q2 incubation operations.',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      'Expected revenue',
      410000,
      168000,
      '2026-02-01',
      'Projected from chick sales, eggs, and mature birds.',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      'Budget plan details',
      null,
      null,
      '2026-02-01',
      E'Funding source: member_contributions\nPayout schedule: monthly\nNotes: Prioritize feed quality and brooder maintenance.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Total budget',
      340000,
      196700,
      '2026-02-01',
      'Allocated for raw materials, processing, and distribution.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Expected revenue',
      520000,
      227000,
      '2026-02-01',
      'Projected from peanut butter units and related products.',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      'Budget plan details',
      null,
      null,
      '2026-02-01',
      E'Funding source: mixed\nPayout schedule: monthly\nNotes: Maintain packaging stock buffer for market days.',
      v_tenant_id
    );

  -- Unified project expenses (with receipt metadata).
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
  values
    (
      v_jpp_project_id,
      v_jpp_batch_id,
      '2026-01-06',
      'Feed',
      9800,
      'Kosele Feeds',
      'Starter mash restock.',
      true,
      'MPESA-Q1F-001',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/receipts/jpp-feed-2026-01-06.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      182340,
      now() - interval '40 days',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      v_jpp_batch_id,
      '2026-01-22',
      'Meds',
      3400,
      'AgroVet Homa Bay',
      'Vaccines and vitamins.',
      true,
      'MPESA-Q1M-004',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/receipts/jpp-meds-2026-01-22.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      154920,
      now() - interval '24 days',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      v_jpp_batch_id,
      '2026-02-08',
      'Utilities',
      2600,
      'KPLC',
      'Incubator and brooder power bill.',
      true,
      'KPLC-0226-88',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/receipts/jpp-utilities-2026-02-08.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      139100,
      now() - interval '8 days',
      v_tenant_id
    ),
    (
      v_jpp_project_id,
      v_jpp_batch_id,
      '2026-02-18',
      'Feed',
      12500,
      'Kosele Feeds',
      'Grower feed purchase.',
      true,
      'MPESA-Q1F-009',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/receipts/jpp-feed-2026-02-18.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      196010,
      now() - interval '3 days',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      v_jgf_batch_id,
      '2026-01-10',
      'Raw Materials',
      7600,
      'Kosele Farmers Coop',
      'Groundnut raw stock purchase.',
      true,
      'MPESA-RM-120',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/receipts/jgf-raw-2026-01-10.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      163800,
      now() - interval '36 days',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      v_jgf_batch_id,
      '2026-01-29',
      'Packaging',
      4200,
      'Lake Labels',
      'Jars and branded labels.',
      true,
      'BANK-PKG-220',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/receipts/jgf-packaging-2026-01-29.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      128400,
      now() - interval '18 days',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      v_jgf_batch_id,
      '2026-02-14',
      'Raw Materials',
      9000,
      'Local Farmers',
      'Raw groundnuts purchase.',
      true,
      'MPESA-RM-342',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/receipts/jgf-raw-2026-02-14.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      174220,
      now() - interval '6 days',
      v_tenant_id
    ),
    (
      v_jgf_project_id,
      v_jgf_batch_id,
      '2026-02-20',
      'Transport',
      2100,
      'Boda Logistics',
      'Market delivery and pickup.',
      true,
      'CASH-TR-091',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/receipts/jgf-transport-2026-02-20.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      117900,
      now() - interval '1 day',
      v_tenant_id
    );

  -- Tasks tab.
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
  values
    (
      v_jpp_project_id,
      'Finalize brooder sanitation checklist',
      'Confirm daily hygiene checks and sign-off points before next hatch.',
      v_secretary_id,
      '2026-02-27',
      'high',
      'in_progress',
      v_admin_member_id,
      null
    ),
    (
      v_jpp_project_id,
      'Order week-12 feed stock',
      'Place feed order to avoid stockout during peak growth window.',
      v_treasurer_id,
      '2026-02-26',
      'urgent',
      'open',
      v_admin_member_id,
      null
    ),
    (
      v_jpp_project_id,
      'Submit hatch survival summary',
      'Compile survival and mortality trends for the committee meeting.',
      v_admin_member_id,
      '2026-02-24',
      'normal',
      'done',
      v_admin_member_id,
      now() - interval '2 days'
    ),
    (
      v_jgf_project_id,
      'Review packaging supplier rates',
      'Compare current vendor pricing with two backup suppliers.',
      v_treasurer_id,
      '2026-02-28',
      'normal',
      'open',
      v_admin_member_id,
      null
    ),
    (
      v_jgf_project_id,
      'Update QA checklist for grinding stage',
      'Add moisture and texture checks to prevent batch inconsistency.',
      v_secretary_id,
      '2026-03-02',
      'high',
      'in_progress',
      v_admin_member_id,
      null
    ),
    (
      v_jgf_project_id,
      'Close January production actions',
      'Mark completed action items and archive unresolved blockers.',
      v_admin_member_id,
      '2026-02-18',
      'normal',
      'done',
      v_admin_member_id,
      now() - interval '4 days'
    );

  -- Notes tab.
  insert into public.project_notes (
    project_id,
    title,
    body,
    visibility,
    author_member_id,
    pinned
  )
  values
    (
      v_jpp_project_id,
      'Incubation quality checkpoints',
      'Temperature drift was lowest when checks were done at 6am and 6pm. Keep this routine for the next cycle.',
      'project_team',
      v_admin_member_id,
      true
    ),
    (
      v_jpp_project_id,
      'Market coordination update',
      'Three local buyers confirmed interest for March intake; align bird readiness by week 2.',
      'project_team',
      v_secretary_id,
      false
    ),
    (
      v_jgf_project_id,
      'Packaging feedback',
      'Retail buyers asked for clearer expiry labels; update print layout before next batch.',
      'project_team',
      v_treasurer_id,
      true
    ),
    (
      v_jgf_project_id,
      'Cost control reminder',
      'Review transport reimbursements every Friday to prevent end-month accumulation.',
      'admins_only',
      v_admin_member_id,
      false
    );

  -- Documents tab.
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
  values
    (
      v_jpp_project_id,
      'JPP Work Plan Q1 2026',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/documents/jpp-work-plan-q1-2026.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      'pdf',
      244211,
      v_admin_member_id,
      now() - interval '20 days'
    ),
    (
      v_jpp_project_id,
      'Brooder SOP v2',
      'tenants/' || v_tenant_id || '/projects/' || v_jpp_project_id || '/documents/brooder-sop-v2.docx',
      '/assets/meeting-minutes-template.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
      86222,
      v_secretary_id,
      now() - interval '12 days'
    ),
    (
      v_jgf_project_id,
      'JGF Production Report Jan 2026',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/documents/jgf-production-report-jan-2026.pdf',
      '/assets/MINUTES JONGOI.pdf',
      'application/pdf',
      'pdf',
      211400,
      v_admin_member_id,
      now() - interval '14 days'
    ),
    (
      v_jgf_project_id,
      'Supplier Contract Checklist',
      'tenants/' || v_tenant_id || '/projects/' || v_jgf_project_id || '/documents/supplier-contract-checklist.docx',
      '/assets/meeting-minutes-template.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
      90410,
      v_treasurer_id,
      now() - interval '5 days'
    );

  -- Media tab (project gallery).
  insert into public.project_gallery (
    project_id,
    image_url,
    caption,
    is_primary,
    display_order,
    tenant_id
  )
  values
    (v_jpp_project_id, '/assets/data-metric.png', 'JPP performance dashboard snapshot.', true, 0, v_tenant_id),
    (v_jpp_project_id, '/assets/automated-tracking.png', 'Task tracking and workflow snapshot.', false, 1, v_tenant_id),
    (v_jpp_project_id, '/assets/update-audit.png', 'Audit and reporting workflow view.', false, 2, v_tenant_id),
    (v_jgf_project_id, '/assets/metrics.png', 'Expense and revenue view for JGF.', true, 0, v_tenant_id),
    (v_jgf_project_id, '/assets/highlight-saas.png', 'Operations highlights for processing team.', false, 1, v_tenant_id),
    (v_jgf_project_id, '/assets/tenants-user.png', 'Project member and role collaboration view.', false, 2, v_tenant_id);
end $$;

commit;
