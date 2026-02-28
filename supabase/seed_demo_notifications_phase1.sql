-- Seed demo notifications for the phase 1 dashboard bell inbox.
-- Safe to re-run; replaces only dedupe keys prefixed with demo-seed:

do $$
declare
  v_tenant_id uuid;
  v_demo_member_id integer;
  v_demo_secretary_id integer;
  v_demo_treasurer_id integer;
begin
  select id
  into v_tenant_id
  from public.tenants
  where slug = 'habuks-demo'
  limit 1;

  if v_tenant_id is null then
    raise exception 'Demo tenant not found for slug habuks-demo';
  end if;

  select m.id
  into v_demo_member_id
  from public.members m
  where m.name = 'Demo Member'
  limit 1;

  select m.id
  into v_demo_secretary_id
  from public.members m
  where m.name = 'Demo Secretary'
  limit 1;

  select m.id
  into v_demo_treasurer_id
  from public.members m
  where m.name = 'Demo Treasurer'
  limit 1;

  if v_demo_member_id is null or v_demo_secretary_id is null or v_demo_treasurer_id is null then
    raise exception 'Expected Demo Member, Demo Secretary, and Demo Treasurer records.';
  end if;

  delete from public.member_notifications
  where tenant_id = v_tenant_id
    and dedupe_key like 'demo-seed:%';

  insert into public.member_notifications (
    tenant_id,
    member_id,
    kind,
    category,
    type,
    title,
    body,
    action_page,
    action_label,
    entity_type,
    entity_id,
    priority,
    status,
    read_at,
    remind_at,
    metadata,
    dedupe_key,
    created_at,
    updated_at
  )
  values
    (
      v_tenant_id,
      v_demo_secretary_id,
      'meeting',
      'meetings',
      'meeting_invite',
      'Meeting invitation: Demo Governing Council Meeting',
      'Scheduled 18 Feb 2026 10:00 AM | Demo Hall, Homa Bay',
      'meetings',
      'Open meeting',
      'meeting',
      '19',
      'normal',
      'unread',
      null,
      timestamptz '2026-02-18 10:00:00+03',
      jsonb_build_object('source', 'demo_seed', 'meeting_id', 19),
      'demo-seed:meeting-invite:demo-secretary',
      timestamptz '2026-02-17 16:30:00+03',
      timestamptz '2026-02-17 16:30:00+03'
    ),
    (
      v_tenant_id,
      v_demo_secretary_id,
      'meeting',
      'meetings',
      'meeting_minutes_ready',
      'Minutes ready: Demo Governing Council Meeting',
      'Minutes are available for review in Activities.',
      'meetings',
      'Open minutes',
      'meeting',
      '19',
      'normal',
      'unread',
      null,
      null,
      jsonb_build_object('source', 'demo_seed', 'meeting_id', 19, 'minutes_status', 'finalized'),
      'demo-seed:meeting-minutes:demo-secretary',
      timestamptz '2026-02-18 13:10:00+03',
      timestamptz '2026-02-18 13:10:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_id,
      'task',
      'tasks',
      'task_assigned',
      'Task assigned: Prepare quarterly treasury note',
      'Demo Poultry Incubation Initiative | Due 24 Feb 2026 | Priority High',
      'projects',
      'Open task',
      'project_task',
      'demo-task-1',
      'high',
      'unread',
      null,
      timestamptz '2026-02-24 09:00:00+03',
      jsonb_build_object('source', 'demo_seed', 'project_name', 'Demo Poultry Incubation Initiative'),
      'demo-seed:task:demo-treasurer',
      timestamptz '2026-02-20 09:15:00+03',
      timestamptz '2026-02-20 09:15:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_id,
      'task',
      'tasks',
      'task_due_soon',
      'Task due soon: Reconcile member contribution ledger',
      'Demo Poultry Incubation Initiative | Due 01 Mar 2026',
      'projects',
      'Open task',
      'project_task',
      'demo-task-reminder-1',
      'high',
      'unread',
      null,
      timestamptz '2026-03-01 09:00:00+03',
      jsonb_build_object('source', 'demo_seed', 'project_name', 'Demo Poultry Incubation Initiative'),
      'demo-seed:task-due-soon:demo-treasurer',
      timestamptz '2026-02-28 08:10:00+03',
      timestamptz '2026-02-28 08:10:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_id,
      'task',
      'tasks',
      'task_overdue',
      'Task overdue: Submit poultry feed variance explanation',
      'Demo Poultry Incubation Initiative | Due 26 Feb 2026',
      'projects',
      'Open task',
      'project_task',
      'demo-task-overdue-1',
      'urgent',
      'unread',
      null,
      timestamptz '2026-02-26 17:00:00+03',
      jsonb_build_object('source', 'demo_seed', 'project_name', 'Demo Poultry Incubation Initiative'),
      'demo-seed:task-overdue:demo-treasurer',
      timestamptz '2026-02-28 08:15:00+03',
      timestamptz '2026-02-28 08:15:00+03'
    ),
    (
      v_tenant_id,
      v_demo_member_id,
      'meeting',
      'meetings',
      'meeting_reminder',
      'Meeting starts soon: Demo Quarterly Planning Session',
      '28 Feb 2026 04:30 PM | Demo Hall, Homa Bay',
      'meetings',
      'Open meeting',
      'meeting',
      'demo-meeting-reminder-1',
      'high',
      'unread',
      null,
      timestamptz '2026-02-28 16:30:00+03',
      jsonb_build_object('source', 'demo_seed', 'location', 'Demo Hall, Homa Bay'),
      'demo-seed:meeting-reminder:demo-member',
      timestamptz '2026-02-28 14:35:00+03',
      timestamptz '2026-02-28 14:35:00+03'
    ),
    (
      v_tenant_id,
      v_demo_member_id,
      'news',
      'updates',
      'news_update',
      'Organization update: Donor review pack published',
      'The latest donor pack and governance summary are available for member review.',
      'news',
      'Open updates',
      'blog',
      'demo-blog-1',
      'normal',
      'read',
      timestamptz '2026-02-16 12:20:00+03',
      null,
      jsonb_build_object('source', 'demo_seed', 'blog_type', 'announcement'),
      'demo-seed:news:demo-member',
      timestamptz '2026-02-16 11:50:00+03',
      timestamptz '2026-02-16 12:20:00+03'
    );
end $$;
