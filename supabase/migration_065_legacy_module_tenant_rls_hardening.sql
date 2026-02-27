-- Migration 065: Harden legacy JPP/JGF table policies (tenant-scoped)
--
-- Context:
-- Some module tables in this environment still rely on tenant_id (without project_id)
-- and retained legacy permissive SELECT policies.
--
-- Goals:
-- 1) Remove permissive read policies (e.g. USING true).
-- 2) Enforce tenant-scoped read for active tenant members.
-- 3) Restrict writes to tenant admins / tenant project managers (plus platform admins).

do $$
declare
  v_table text;
  v_policy text;
  v_tables text[] := array[
    'jpp_batches',
    'jpp_daily_log',
    'jpp_weekly_growth',
    'jpp_birds',
    'jgf_batches',
    'jgf_production_logs',
    'jgf_sales',
    'jgf_expenses',
    'jgf_inventory',
    'jgf_purchases',
    'jgf_land_leases',
    'jgf_crop_cycles',
    'jgf_farming_activities'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table
        and c.column_name = 'tenant_id'
    ) then
      continue;
    end if;

    -- If project_id exists, migration_062 handles the table; skip here.
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table
        and c.column_name = 'project_id'
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', v_table);

    for v_policy in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1
          from public.members m
          left join public.tenant_members tm
            on tm.member_id = m.id
           and tm.tenant_id = tenant_id
           and tm.status = ''active''
          where m.auth_id = auth.uid()
            and (
              m.role in (''admin'', ''superadmin'')
              or tm.id is not null
            )
        )
      )',
      format('rls_%s_tenant_read', v_table),
      v_table
    );

    execute format(
      'create policy %I on public.%I for all to authenticated using (
        exists (
          select 1
          from public.members m
          left join public.tenant_members tm
            on tm.member_id = m.id
           and tm.tenant_id = tenant_id
           and tm.status = ''active''
          where m.auth_id = auth.uid()
            and (
              m.role in (''admin'', ''superadmin'')
              or tm.role in (''admin'', ''superadmin'', ''project_manager'')
            )
        )
      ) with check (
        exists (
          select 1
          from public.members m
          left join public.tenant_members tm
            on tm.member_id = m.id
           and tm.tenant_id = tenant_id
           and tm.status = ''active''
          where m.auth_id = auth.uid()
            and (
              m.role in (''admin'', ''superadmin'')
              or tm.role in (''admin'', ''superadmin'', ''project_manager'')
            )
        )
      )',
      format('rls_%s_tenant_manage', v_table),
      v_table
    );
  end loop;
end
$$;

