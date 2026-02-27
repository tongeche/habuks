-- Migration 062: Harden project table RLS for role-based writes
--
-- Goals:
-- 1) Remove legacy permissive policies (including USING true).
-- 2) Enforce read/write by project helper predicates only.
-- 3) Ensure members remain read-only while managers/admins can mutate.

do $$
declare
  v_table text;
  v_policy text;
  v_tables text[] := array[
    'project_expenses',
    'project_expense_items',
    'project_sales',
    'project_products',
    'project_stock_movements',
    'project_expense_categories',
    'project_tasks',
    'project_notes',
    'project_documents',
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
      'create policy %I on public.%I for select to authenticated using (public.can_access_iga_project(project_id))',
      format('rls_%s_read', v_table),
      v_table
    );

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_manage_iga_project(project_id)) with check (public.can_manage_iga_project(project_id))',
      format('rls_%s_manage', v_table),
      v_table
    );
  end loop;

  -- Notes marked admins_only are hidden from read-only members.
  if to_regclass('public.project_notes') is not null then
    execute 'drop policy if exists rls_project_notes_read on public.project_notes';
    execute $policy$
      create policy rls_project_notes_read
      on public.project_notes
      for select
      to authenticated
      using (
        public.can_access_iga_project(project_id)
        and (
          coalesce(visibility, 'project_team') <> 'admins_only'
          or public.can_manage_iga_project(project_id)
        )
      )
    $policy$;
  end if;
end
$$;

