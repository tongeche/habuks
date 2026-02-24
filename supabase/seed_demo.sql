-- Minimal demo seed for Habuks multi-tenant setup
-- Safe to re-run; scoped to the habuks-demo tenant.

begin;

do $$
declare
  v_tenant_id uuid;
  v_demo_member_id integer;
  v_treasurer_id integer;
  v_secretary_id integer;
  v_jpp_project_id integer;
  v_jgf_project_id integer;
  v_bird_product_id uuid;
  v_jpp_batch_id uuid;
  v_jgf_batch_id uuid;
  v_welfare_account_id integer;
  v_cycle1_id integer;
  v_cycle2_id integer;
  v_cycle3_id integer;
  v_cycle4_id integer;
  v_land_lease_id integer;
  v_crop_cycle_id integer;
  seq_name text;
begin
  -- Tenant
  insert into tenants (name, slug, tagline, contact_email, contact_phone, location, is_public, logo_url, site_data)
  values (
    'Habuks Demo Collective',
    'habuks-demo',
    'Demo workspace for Habuks',
    'demo@habuks.com',
    '+254700000100',
    'Homa Bay, Kenya',
    true,
    '/assets/logo.png',
    jsonb_build_object(
      'orgName', 'Habuks Demo Collective',
      'orgTagline', 'Tenant demo workspace',
      'logoUrl', '/assets/logo.png',
      'theme', jsonb_build_object(
        'sidebar', '#0b1f1d',
        'sidebarAlt', '#123a36',
        'sidebarAlt2', '#1b4f4a',
        'primary', '#1b8a5a',
        'primaryDark', '#0f6b45',
        'secondary', '#30c48d',
        'accent', '#f59e0b',
        'accentDark', '#d97706'
      )
    )
  )
  on conflict (slug) do update set
    name = excluded.name,
    tagline = excluded.tagline,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    location = excluded.location,
    is_public = excluded.is_public,
    logo_url = excluded.logo_url,
    site_data = excluded.site_data
  returning id into v_tenant_id;

  if v_tenant_id is null then
    select id into v_tenant_id from tenants where slug = 'habuks-demo';
  end if;

  -- Ensure serial sequences are in sync to avoid duplicate key errors
  seq_name := pg_get_serial_sequence('public.members', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.members), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.iga_projects', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.iga_projects), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.iga_committee_members', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.iga_committee_members), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.project_expense_items', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.project_expense_items), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.contributions', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.contributions), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.payouts', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.payouts), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.welfare_accounts', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.welfare_accounts), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.welfare_cycles', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.welfare_cycles), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.welfare_transactions', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.welfare_transactions), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.welfare_balances', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.welfare_balances), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_inventory', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_inventory), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_purchases', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_purchases), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_land_leases', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_land_leases), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_crop_cycles', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_crop_cycles), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_farming_activities', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_farming_activities), 1), 1), true);
  end if;
  seq_name := pg_get_serial_sequence('public.jgf_production_logs', 'id');
  if seq_name is not null then
    perform setval(seq_name, greatest(coalesce((select max(id) from public.jgf_production_logs), 1), 1), true);
  end if;

  -- Members
  insert into members (name, email, phone_number, password_hash, join_date, status, role)
  values (
    'Demo Member',
    'demo.member@habuks.com',
    '+254700000110',
    'demo_seed',
    '2025-11-15',
    'active',
    'admin'
  )
  on conflict (email) do update set
    name = excluded.name,
    phone_number = excluded.phone_number,
    join_date = excluded.join_date
  returning id into v_demo_member_id;

  if v_demo_member_id is null then
    select id into v_demo_member_id from members where lower(email) = lower('demo.member@habuks.com');
  end if;

  insert into members (name, email, phone_number, password_hash, join_date, status, role)
  values (
    'Demo Treasurer',
    'demo.treasurer@habuks.com',
    '+254700000111',
    'demo_seed',
    '2025-12-01',
    'active',
    'member'
  )
  on conflict (email) do update set
    name = excluded.name,
    phone_number = excluded.phone_number,
    join_date = excluded.join_date
  returning id into v_treasurer_id;

  if v_treasurer_id is null then
    select id into v_treasurer_id from members where lower(email) = lower('demo.treasurer@habuks.com');
  end if;

  insert into members (name, email, phone_number, password_hash, join_date, status, role)
  values (
    'Demo Secretary',
    'demo.secretary@habuks.com',
    '+254700000112',
    'demo_seed',
    '2025-12-10',
    'active',
    'member'
  )
  on conflict (email) do update set
    name = excluded.name,
    phone_number = excluded.phone_number,
    join_date = excluded.join_date
  returning id into v_secretary_id;

  if v_secretary_id is null then
    select id into v_secretary_id from members where lower(email) = lower('demo.secretary@habuks.com');
  end if;

  -- Tenant membership
  insert into tenant_members (tenant_id, member_id, role, status)
  values (v_tenant_id, v_demo_member_id, 'admin', 'active')
  on conflict (tenant_id, member_id) do update set
    role = excluded.role,
    status = excluded.status;

  insert into tenant_members (tenant_id, member_id, role, status)
  values (v_tenant_id, v_treasurer_id, 'member', 'active')
  on conflict (tenant_id, member_id) do update set
    role = excluded.role,
    status = excluded.status;

  insert into tenant_members (tenant_id, member_id, role, status)
  values (v_tenant_id, v_secretary_id, 'member', 'active')
  on conflict (tenant_id, member_id) do update set
    role = excluded.role,
    status = excluded.status;

  -- Projects
  insert into iga_projects (
    tenant_id,
    code,
    name,
    tagline,
    short_description,
    description,
    start_date,
    status,
    location,
    project_leader,
    is_recruiting,
    is_visible,
    display_order
  )
  values (
    v_tenant_id,
    'JPP',
    'Poultry Incubation Initiative',
    'Hatching livelihoods, one coop at a time.',
    'Demo poultry incubation and brooding module.',
    'A demo project showcasing incubation, brooding, and poultry sales tracking.',
    '2025-11-01',
    'active',
    'Kosele, Homa Bay County',
    v_demo_member_id,
    true,
    true,
    1
  )
  on conflict (tenant_id, code) do update set
    name = excluded.name,
    tagline = excluded.tagline,
    short_description = excluded.short_description,
    description = excluded.description,
    start_date = excluded.start_date,
    status = excluded.status,
    location = excluded.location,
    project_leader = excluded.project_leader,
    is_recruiting = excluded.is_recruiting,
    is_visible = excluded.is_visible,
    display_order = excluded.display_order
  returning id into v_jpp_project_id;

  if v_jpp_project_id is null then
    select id into v_jpp_project_id
    from iga_projects
    where tenant_id = v_tenant_id and code = 'JPP';
  end if;

  insert into iga_projects (
    tenant_id,
    code,
    name,
    tagline,
    short_description,
    description,
    start_date,
    status,
    location,
    project_leader,
    is_recruiting,
    is_visible,
    display_order
  )
  values (
    v_tenant_id,
    'JGF',
    'Jongol Groundnut Foods',
    'Value-added groundnuts for the community.',
    'Demo groundnut processing and sales workflow.',
    'A demo project for processing groundnuts into peanut butter and related products.',
    '2025-11-15',
    'active',
    'Kosele, Homa Bay County',
    v_demo_member_id,
    true,
    true,
    2
  )
  on conflict (tenant_id, code) do update set
    name = excluded.name,
    tagline = excluded.tagline,
    short_description = excluded.short_description,
    description = excluded.description,
    start_date = excluded.start_date,
    status = excluded.status,
    location = excluded.location,
    project_leader = excluded.project_leader,
    is_recruiting = excluded.is_recruiting,
    is_visible = excluded.is_visible,
    display_order = excluded.display_order
  returning id into v_jgf_project_id;

  if v_jgf_project_id is null then
    select id into v_jgf_project_id
    from iga_projects
    where tenant_id = v_tenant_id and code = 'JGF';
  end if;

  -- Project membership
  insert into iga_committee_members (tenant_id, project_id, member_id, role, term_start)
  select v_tenant_id, v_jpp_project_id, v_demo_member_id, 'Project Lead', '2025-11-01'
  where not exists (
    select 1 from iga_committee_members
    where tenant_id = v_tenant_id
      and project_id = v_jpp_project_id
      and member_id = v_demo_member_id
  );

  insert into iga_committee_members (tenant_id, project_id, member_id, role, term_start)
  select v_tenant_id, v_jgf_project_id, v_demo_member_id, 'Project Lead', '2025-11-15'
  where not exists (
    select 1 from iga_committee_members
    where tenant_id = v_tenant_id
      and project_id = v_jgf_project_id
      and member_id = v_demo_member_id
  );

  insert into iga_committee_members (tenant_id, project_id, member_id, role, term_start)
  select v_tenant_id, v_jpp_project_id, v_treasurer_id, 'Treasurer', '2025-12-01'
  where not exists (
    select 1 from iga_committee_members
    where tenant_id = v_tenant_id
      and project_id = v_jpp_project_id
      and member_id = v_treasurer_id
  );

  -- Expense items (categories)
  insert into project_expense_items (project_id, label, category, display_order, is_active, tenant_id)
  values
    (v_jpp_project_id, 'Layer feed (mash)', 'Feed', 1, true, v_tenant_id),
    (v_jpp_project_id, 'Vitamins/minerals', 'Meds', 2, true, v_tenant_id),
    (v_jpp_project_id, 'Electricity', 'Utilities', 3, true, v_tenant_id)
  on conflict (project_id, label) do update set
    category = excluded.category,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    tenant_id = excluded.tenant_id;

  insert into project_expense_items (project_id, label, category, display_order, is_active, tenant_id)
  values
    (v_jgf_project_id, 'Raw groundnuts', 'Raw Materials', 1, true, v_tenant_id),
    (v_jgf_project_id, 'Packaging jars', 'Packaging', 2, true, v_tenant_id),
    (v_jgf_project_id, 'Transport', 'Transport', 3, true, v_tenant_id)
  on conflict (project_id, label) do update set
    category = excluded.category,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    tenant_id = excluded.tenant_id;

  -- Project products (JPP)
  insert into project_products (project_id, name, category, tracking_mode, unit, is_active, tenant_id)
  values
    (v_jpp_project_id, 'Live Birds', 'livestock', 'individual', 'birds', true, v_tenant_id),
    (v_jpp_project_id, 'Eggs', 'eggs', 'bulk', 'trays', true, v_tenant_id)
  on conflict (project_id, name) do update set
    category = excluded.category,
    tracking_mode = excluded.tracking_mode,
    unit = excluded.unit,
    is_active = excluded.is_active,
    tenant_id = excluded.tenant_id;

  select id into v_bird_product_id
  from project_products
  where project_id = v_jpp_project_id
    and name = 'Live Birds';

  -- JPP batches
  insert into jpp_batches (
    batch_code,
    batch_name,
    start_date,
    supplier_name,
    bird_type,
    breed,
    starting_count,
    feed_on_hand_kg,
    notes,
    tenant_id
  )
  values (
    'HAB-JPP-2026-01-A',
    'Demo Brooder A',
    '2026-01-10',
    'Homa Bay Hatchery',
    'Layer',
    'Kuroiler',
    200,
    75,
    'Demo batch for poultry tracking.',
    v_tenant_id
  )
  on conflict (batch_code) do update set
    batch_name = excluded.batch_name,
    start_date = excluded.start_date,
    supplier_name = excluded.supplier_name,
    bird_type = excluded.bird_type,
    breed = excluded.breed,
    starting_count = excluded.starting_count,
    feed_on_hand_kg = excluded.feed_on_hand_kg,
    notes = excluded.notes,
    tenant_id = excluded.tenant_id;

  select id into v_jpp_batch_id
  from jpp_batches
  where batch_code = 'HAB-JPP-2026-01-A';

  -- JPP daily log
  insert into jpp_daily_log (
    batch_id,
    log_date,
    water_clean_full_am,
    feed_given_am,
    feed_given_pm,
    temp_vent_ok,
    alive_count,
    deaths_today,
    feed_used_kg,
    water_refills,
    money_spent,
    notes,
    tenant_id
  )
  values (
    v_jpp_batch_id,
    '2026-02-18',
    true,
    true,
    true,
    true,
    195,
    1,
    16.5,
    3,
    800,
    'Routine checks and feed updates.',
    v_tenant_id
  )
  on conflict (batch_id, log_date) do update set
    water_clean_full_am = excluded.water_clean_full_am,
    feed_given_am = excluded.feed_given_am,
    feed_given_pm = excluded.feed_given_pm,
    temp_vent_ok = excluded.temp_vent_ok,
    alive_count = excluded.alive_count,
    deaths_today = excluded.deaths_today,
    feed_used_kg = excluded.feed_used_kg,
    water_refills = excluded.water_refills,
    money_spent = excluded.money_spent,
    notes = excluded.notes,
    tenant_id = excluded.tenant_id;

  -- JPP weekly growth
  insert into jpp_weekly_growth (
    batch_id,
    week_ending,
    sample_size,
    avg_weight_kg,
    min_weight_kg,
    max_weight_kg,
    body_score_avg,
    feed_used_week_kg,
    birds_sold,
    birds_culled,
    notes,
    tenant_id
  )
  values (
    v_jpp_batch_id,
    '2026-02-16',
    20,
    1.45,
    1.2,
    1.6,
    3.8,
    115,
    0,
    0,
    'Weekly growth check.',
    v_tenant_id
  )
  on conflict (batch_id, week_ending) do update set
    sample_size = excluded.sample_size,
    avg_weight_kg = excluded.avg_weight_kg,
    min_weight_kg = excluded.min_weight_kg,
    max_weight_kg = excluded.max_weight_kg,
    body_score_avg = excluded.body_score_avg,
    feed_used_week_kg = excluded.feed_used_week_kg,
    birds_sold = excluded.birds_sold,
    birds_culled = excluded.birds_culled,
    notes = excluded.notes,
    tenant_id = excluded.tenant_id;

  -- JPP birds
  insert into jpp_birds (
    product_id,
    batch_id,
    tag_id,
    sex,
    breed_label,
    acquired_date,
    acquired_source,
    status,
    status_date,
    age_stage,
    notes,
    tenant_id
  )
  values
    (
      v_bird_product_id,
      v_jpp_batch_id,
      'HAB-JPP-001',
      'female',
      'Kuroiler',
      '2026-01-10',
      'bought',
      'alive',
      '2026-02-18',
      'pullet',
      'Healthy demo bird.',
      v_tenant_id
    ),
    (
      v_bird_product_id,
      v_jpp_batch_id,
      'HAB-JPP-002',
      'male',
      'Kuroiler',
      '2026-01-10',
      'bought',
      'alive',
      '2026-02-18',
      'cockerel',
      'Growth on track.',
      v_tenant_id
    )
  on conflict (tag_id) do update set
    status = excluded.status,
    status_date = excluded.status_date,
    notes = excluded.notes,
    tenant_id = excluded.tenant_id;

  -- JGF batches
  insert into jgf_batches (
    batch_code,
    batch_name,
    product_type,
    start_date,
    status,
    raw_groundnuts_kg,
    output_quantity_kg,
    output_units,
    unit_size_grams,
    selling_price_per_unit,
    notes,
    tenant_id
  )
  select
    'HAB-JGF-2026-01',
    'Demo Peanut Butter Batch',
    'peanut_butter',
    '2026-01-18',
    'in_progress',
    120,
    95,
    190,
    500,
    350,
    'Demo batch for groundnut processing.',
    v_tenant_id
  where not exists (
    select 1 from jgf_batches
    where batch_code = 'HAB-JGF-2026-01'
      and tenant_id = v_tenant_id
  );

  select id into v_jgf_batch_id
  from jgf_batches
  where batch_code = 'HAB-JGF-2026-01'
    and tenant_id = v_tenant_id
  limit 1;

  -- JGF production logs
  insert into jgf_production_logs (
    batch_id,
    log_date,
    groundnuts_processed_kg,
    output_produced_kg,
    units_packaged,
    quality_grade,
    workers_count,
    hours_worked,
    equipment_used,
    issues_notes,
    tenant_id
  )
  select
    v_jgf_batch_id,
    '2026-02-15',
    80,
    60,
    120,
    'premium',
    4,
    6,
    'Roaster + Grinder',
    'Smooth run, no issues.',
    v_tenant_id
  where not exists (
    select 1 from jgf_production_logs
    where batch_id = v_jgf_batch_id
      and log_date = '2026-02-15'
      and tenant_id = v_tenant_id
  );

  -- JGF inventory
  insert into jgf_inventory (
    item_type,
    item_name,
    quantity,
    unit,
    unit_cost,
    reorder_level,
    supplier_name,
    last_restocked,
    notes,
    tenant_id
  )
  select
    'raw_material',
    'Groundnuts',
    150,
    'kg',
    120,
    30,
    'Kosele Farmers Coop',
    '2026-02-14',
    'Demo inventory item.',
    v_tenant_id
  where not exists (
    select 1 from jgf_inventory
    where item_type = 'raw_material'
      and item_name = 'Groundnuts'
      and tenant_id = v_tenant_id
  );

  -- JGF purchases
  insert into jgf_purchases (
    purchase_date,
    supplier_name,
    supplier_contact,
    item_type,
    quantity,
    unit,
    unit_price,
    total_amount,
    quality_grade,
    payment_status,
    notes,
    tenant_id
  )
  select
    '2026-02-14',
    'Kosele Farmers Coop',
    '+254700000200',
    'groundnuts',
    100,
    'kg',
    90,
    9000,
    'A',
    'paid',
    'Demo purchase record.',
    v_tenant_id
  where not exists (
    select 1 from jgf_purchases
    where purchase_date = '2026-02-14'
      and supplier_name = 'Kosele Farmers Coop'
      and item_type = 'groundnuts'
      and tenant_id = v_tenant_id
  );

  -- JGF land leases
  insert into jgf_land_leases (
    name,
    location,
    size_acres,
    lease_cost,
    start_date,
    end_date,
    landowner_name,
    landowner_contact,
    status,
    notes,
    tenant_id
  )
  select
    'Demo Plot A',
    'Kosele',
    2.5,
    15000,
    '2026-01-01',
    '2026-12-31',
    'Mr. Odhiambo',
    '+254700000300',
    'active',
    'Demo land lease.',
    v_tenant_id
  where not exists (
    select 1 from jgf_land_leases
    where name = 'Demo Plot A'
      and tenant_id = v_tenant_id
  );

  select id into v_land_lease_id
  from jgf_land_leases
  where name = 'Demo Plot A'
    and tenant_id = v_tenant_id
  limit 1;

  -- JGF crop cycles
  insert into jgf_crop_cycles (
    lease_id,
    cycle_name,
    crop_variety,
    start_date,
    harvest_date,
    status,
    projected_yield_kg,
    notes,
    tenant_id
  )
  select
    v_land_lease_id,
    'Demo Season 2026',
    'Groundnuts',
    '2026-02-01',
    '2026-06-30',
    'growing',
    500,
    'Demo crop cycle.',
    v_tenant_id
  where not exists (
    select 1 from jgf_crop_cycles
    where lease_id = v_land_lease_id
      and cycle_name = 'Demo Season 2026'
      and tenant_id = v_tenant_id
  );

  select id into v_crop_cycle_id
  from jgf_crop_cycles
  where lease_id = v_land_lease_id
    and cycle_name = 'Demo Season 2026'
    and tenant_id = v_tenant_id
  limit 1;

  -- JGF farming activities
  insert into jgf_farming_activities (
    cycle_id,
    activity_date,
    activity_type,
    description,
    labour_cost,
    input_cost,
    equipment_cost,
    other_cost,
    notes,
    tenant_id
  )
  select
    v_crop_cycle_id,
    '2026-02-05',
    'planting',
    'Planted demo groundnut crop.',
    1200,
    2500,
    800,
    0,
    'Demo activity log.',
    v_tenant_id
  where not exists (
    select 1 from jgf_farming_activities
    where cycle_id = v_crop_cycle_id
      and activity_date = '2026-02-05'
      and activity_type = 'planting'
      and tenant_id = v_tenant_id
  );

  -- Project expenses (unified)
  insert into project_expenses (
    project_id,
    batch_id,
    expense_date,
    category,
    amount,
    vendor,
    description,
    receipt,
    tenant_id
  )
  select
    v_jpp_project_id,
    v_jpp_batch_id,
    '2026-02-16',
    'Feed',
    12500,
    'Kosele Feeds',
    'Starter feed purchase.',
    true,
    v_tenant_id
  where not exists (
    select 1 from project_expenses
    where project_id = v_jpp_project_id
      and expense_date = '2026-02-16'
      and category = 'Feed'
      and amount = 12500
      and tenant_id = v_tenant_id
  );

  insert into project_expenses (
    project_id,
    batch_id,
    expense_date,
    category,
    amount,
    vendor,
    description,
    receipt,
    tenant_id
  )
  select
    v_jgf_project_id,
    v_jgf_batch_id,
    '2026-02-14',
    'Raw Materials',
    9000,
    'Local Farmers',
    'Raw groundnuts purchase.',
    true,
    v_tenant_id
  where not exists (
    select 1 from project_expenses
    where project_id = v_jgf_project_id
      and expense_date = '2026-02-14'
      and category = 'Raw Materials'
      and amount = 9000
      and tenant_id = v_tenant_id
  );

  -- Project sales (unified)
  insert into project_sales (
    project_id,
    batch_id,
    sale_date,
    product_type,
    quantity_units,
    unit_price,
    total_amount,
    customer_name,
    customer_type,
    payment_status,
    payment_method,
    tenant_id
  )
  select
    v_jpp_project_id,
    v_jpp_batch_id,
    '2026-02-18',
    'eggs',
    12,
    450,
    5400,
    'Kosele Market',
    'retail',
    'paid',
    'cash',
    v_tenant_id
  where not exists (
    select 1 from project_sales
    where project_id = v_jpp_project_id
      and sale_date = '2026-02-18'
      and product_type = 'eggs'
      and total_amount = 5400
      and tenant_id = v_tenant_id
  );

  insert into project_sales (
    project_id,
    batch_id,
    sale_date,
    product_type,
    quantity_units,
    unit_price,
    total_amount,
    customer_name,
    customer_type,
    payment_status,
    payment_method,
    tenant_id
  )
  select
    v_jgf_project_id,
    v_jgf_batch_id,
    '2026-02-18',
    'peanut_butter',
    40,
    350,
    14000,
    'Kosele Market',
    'retail',
    'paid',
    'mpesa',
    v_tenant_id
  where not exists (
    select 1 from project_sales
    where project_id = v_jgf_project_id
      and sale_date = '2026-02-18'
      and product_type = 'peanut_butter'
      and total_amount = 14000
      and tenant_id = v_tenant_id
  );

  -- Contributions
  insert into contributions (member_id, amount, date, cycle_number, tenant_id)
  select v_demo_member_id, 500, '2026-01-05', 1, v_tenant_id
  where not exists (
    select 1 from contributions
    where member_id = v_demo_member_id
      and date = '2026-01-05'
      and cycle_number = 1
      and tenant_id = v_tenant_id
  );

  insert into contributions (member_id, amount, date, cycle_number, tenant_id)
  select v_demo_member_id, 500, '2026-01-19', 2, v_tenant_id
  where not exists (
    select 1 from contributions
    where member_id = v_demo_member_id
      and date = '2026-01-19'
      and cycle_number = 2
      and tenant_id = v_tenant_id
  );

  -- Payouts
  insert into payouts (member_id, amount, date, cycle_number, tenant_id)
  select v_treasurer_id, 5000, '2026-01-01', 1, v_tenant_id
  where not exists (
    select 1 from payouts
    where cycle_number = 1
      and tenant_id = v_tenant_id
  );

  insert into payouts (member_id, amount, date, cycle_number, tenant_id)
  select v_secretary_id, 5000, '2026-01-15', 2, v_tenant_id
  where not exists (
    select 1 from payouts
    where cycle_number = 2
      and tenant_id = v_tenant_id
  );

  insert into payouts (member_id, amount, date, cycle_number, tenant_id)
  select v_treasurer_id, 5000, '2026-01-29', 3, v_tenant_id
  where not exists (
    select 1 from payouts
    where cycle_number = 3
      and tenant_id = v_tenant_id
  );

  insert into payouts (member_id, amount, date, cycle_number, tenant_id)
  select v_demo_member_id, 5000, '2026-02-25', 4, v_tenant_id
  where not exists (
    select 1 from payouts
    where cycle_number = 4
      and tenant_id = v_tenant_id
  );

  -- Welfare account
  select id into v_welfare_account_id
  from welfare_accounts
  where tenant_id = v_tenant_id
    and name = 'Main Welfare Fund'
  limit 1;

  if v_welfare_account_id is null then
    insert into welfare_accounts (name, description, tenant_id)
    values ('Main Welfare Fund', 'Demo tenant welfare savings', v_tenant_id)
    returning id into v_welfare_account_id;
  end if;

  -- Welfare cycles
  insert into welfare_cycles (start_date, end_date, cycle_number, total_contributed, total_disbursed, tenant_id)
  select '2026-01-01', '2026-01-14', 1, 1500, 5000, v_tenant_id
  where not exists (
    select 1 from welfare_cycles
    where cycle_number = 1
      and tenant_id = v_tenant_id
  );

  insert into welfare_cycles (start_date, end_date, cycle_number, total_contributed, total_disbursed, tenant_id)
  select '2026-01-15', '2026-01-28', 2, 1500, 5000, v_tenant_id
  where not exists (
    select 1 from welfare_cycles
    where cycle_number = 2
      and tenant_id = v_tenant_id
  );

  insert into welfare_cycles (start_date, end_date, cycle_number, total_contributed, total_disbursed, tenant_id)
  select '2026-01-29', '2026-02-11', 3, 1500, 5000, v_tenant_id
  where not exists (
    select 1 from welfare_cycles
    where cycle_number = 3
      and tenant_id = v_tenant_id
  );

  insert into welfare_cycles (start_date, end_date, cycle_number, total_contributed, total_disbursed, tenant_id)
  select '2026-02-25', '2026-03-10', 4, 1500, 5000, v_tenant_id
  where not exists (
    select 1 from welfare_cycles
    where cycle_number = 4
      and tenant_id = v_tenant_id
  );

  select id into v_cycle1_id from welfare_cycles where cycle_number = 1 and tenant_id = v_tenant_id;
  select id into v_cycle2_id from welfare_cycles where cycle_number = 2 and tenant_id = v_tenant_id;
  select id into v_cycle3_id from welfare_cycles where cycle_number = 3 and tenant_id = v_tenant_id;
  select id into v_cycle4_id from welfare_cycles where cycle_number = 4 and tenant_id = v_tenant_id;

  -- Welfare transactions
  insert into welfare_transactions (
    welfare_account_id,
    cycle_id,
    member_id,
    amount,
    transaction_type,
    date,
    description,
    tenant_id
  )
  select v_welfare_account_id, v_cycle1_id, null, 1000, 'contribution', '2026-01-01', 'Cycle 1 welfare contribution', v_tenant_id
  where not exists (
    select 1 from welfare_transactions
    where welfare_account_id = v_welfare_account_id
      and cycle_id = v_cycle1_id
      and transaction_type = 'contribution'
      and tenant_id = v_tenant_id
  );

  insert into welfare_transactions (
    welfare_account_id,
    cycle_id,
    member_id,
    amount,
    transaction_type,
    date,
    description,
    tenant_id
  )
  select v_welfare_account_id, v_cycle2_id, null, 1000, 'contribution', '2026-01-15', 'Cycle 2 welfare contribution', v_tenant_id
  where not exists (
    select 1 from welfare_transactions
    where welfare_account_id = v_welfare_account_id
      and cycle_id = v_cycle2_id
      and transaction_type = 'contribution'
      and tenant_id = v_tenant_id
  );

  -- Welfare balances
  insert into welfare_balances (welfare_account_id, cycle_id, balance, tenant_id)
  select v_welfare_account_id, v_cycle1_id, 1000, v_tenant_id
  where not exists (
    select 1 from welfare_balances
    where welfare_account_id = v_welfare_account_id
      and cycle_id = v_cycle1_id
      and tenant_id = v_tenant_id
  );

  insert into welfare_balances (welfare_account_id, cycle_id, balance, tenant_id)
  select v_welfare_account_id, v_cycle2_id, 2000, v_tenant_id
  where not exists (
    select 1 from welfare_balances
    where welfare_account_id = v_welfare_account_id
      and cycle_id = v_cycle2_id
      and tenant_id = v_tenant_id
  );

  insert into welfare_balances (welfare_account_id, cycle_id, balance, tenant_id)
  select v_welfare_account_id, v_cycle3_id, 3000, v_tenant_id
  where not exists (
    select 1 from welfare_balances
    where welfare_account_id = v_welfare_account_id
      and cycle_id = v_cycle3_id
      and tenant_id = v_tenant_id
  );
end $$;

commit;
