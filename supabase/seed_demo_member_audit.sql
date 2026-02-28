-- Seed demo tenant member access history
-- Safe to re-run; only replaces rows tagged with metadata.source = 'demo_seed'
-- in the habuks-demo tenant audit log.

do $$
declare
  v_tenant_id uuid;
  v_demo_member_id integer;
  v_demo_member_membership_id uuid;
  v_demo_secretary_id integer;
  v_demo_secretary_membership_id uuid;
  v_demo_treasurer_id integer;
  v_demo_treasurer_membership_id uuid;
  v_demo_organizer_id integer;
  v_demo_organizer_membership_id uuid;
begin
  select id
  into v_tenant_id
  from public.tenants
  where slug = 'habuks-demo'
  limit 1;

  if v_tenant_id is null then
    raise exception 'Demo tenant not found for slug habuks-demo';
  end if;

  select tm.member_id, tm.id
  into v_demo_member_id, v_demo_member_membership_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and m.name = 'Demo Member'
  limit 1;

  select tm.member_id, tm.id
  into v_demo_secretary_id, v_demo_secretary_membership_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and m.name = 'Demo Secretary'
  limit 1;

  select tm.member_id, tm.id
  into v_demo_treasurer_id, v_demo_treasurer_membership_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and m.name = 'Demo Treasurer'
  limit 1;

  select tm.member_id, tm.id
  into v_demo_organizer_id, v_demo_organizer_membership_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and m.name = 'demo-organizer'
  limit 1;

  if v_demo_member_id is null
     or v_demo_secretary_id is null
     or v_demo_treasurer_id is null
     or v_demo_organizer_id is null then
    raise exception 'Expected Demo Member, Demo Secretary, Demo Treasurer, and demo-organizer in habuks-demo.';
  end if;

  delete from public.tenant_member_audit_log
  where tenant_id = v_tenant_id
    and coalesce(metadata ->> 'source', '') = 'demo_seed';

  insert into public.tenant_member_audit_log (
    tenant_id,
    tenant_membership_id,
    member_id,
    member_name,
    actor_member_id,
    actor_name,
    action,
    previous_role,
    next_role,
    previous_status,
    next_status,
    note,
    metadata,
    occurred_at
  )
  values
    (
      v_tenant_id,
      v_demo_member_membership_id,
      v_demo_member_id,
      'Demo Member',
      v_demo_member_id,
      'Demo Member',
      'membership_added',
      null,
      'member',
      null,
      'active',
      'Added to the organization as Member.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_member_joined'),
      timestamptz '2026-01-08 09:05:00+03'
    ),
    (
      v_tenant_id,
      v_demo_member_membership_id,
      v_demo_member_id,
      'Demo Member',
      v_demo_member_id,
      'Demo Member',
      'made_admin',
      'member',
      'admin',
      'active',
      'active',
      'Made admin.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_member_promoted'),
      timestamptz '2026-01-09 10:20:00+03'
    ),
    (
      v_tenant_id,
      v_demo_secretary_membership_id,
      v_demo_secretary_id,
      'Demo Secretary',
      v_demo_member_id,
      'Demo Member',
      'membership_added',
      null,
      'member',
      null,
      'active',
      'Added to the organization as Member.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_secretary_joined'),
      timestamptz '2026-01-10 08:35:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_membership_id,
      v_demo_treasurer_id,
      'Demo Treasurer',
      v_demo_member_id,
      'Demo Member',
      'membership_added',
      null,
      'member',
      null,
      'active',
      'Added to the organization as Member.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_treasurer_joined'),
      timestamptz '2026-01-10 09:10:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_membership_id,
      v_demo_treasurer_id,
      'Demo Treasurer',
      v_demo_member_id,
      'Demo Member',
      'dismissed',
      'member',
      'member',
      'active',
      'inactive',
      'Dismissed from active organization access.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_treasurer_dismissed'),
      timestamptz '2026-02-03 15:05:00+03'
    ),
    (
      v_tenant_id,
      v_demo_treasurer_membership_id,
      v_demo_treasurer_id,
      'Demo Treasurer',
      v_demo_member_id,
      'Demo Member',
      'reinstated',
      'member',
      'member',
      'inactive',
      'active',
      'Reinstated to active organization access.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_treasurer_reinstated'),
      timestamptz '2026-02-07 11:45:00+03'
    ),
    (
      v_tenant_id,
      v_demo_organizer_membership_id,
      v_demo_organizer_id,
      'demo-organizer',
      v_demo_member_id,
      'Demo Member',
      'membership_added',
      null,
      'member',
      null,
      'active',
      'Added to the organization as Member.',
      jsonb_build_object('source', 'demo_seed', 'seed_key', 'demo_organizer_joined'),
      timestamptz '2026-02-14 14:15:00+03'
    );
end $$;
