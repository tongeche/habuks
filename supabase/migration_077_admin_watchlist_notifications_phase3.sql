-- Migration 077: Admin watchlist notifications phase 3
--
-- Adds admin-only watchlist summaries to the existing notification inbox:
-- - pending workspace invites
-- - overdue workspace tasks
-- - meetings awaiting finalized minutes
--
-- These summaries are refreshed alongside the existing reminder RPC and
-- preserve read state unless the underlying summary changes.

create or replace function public.upsert_member_watchlist_notification(
  p_tenant_id uuid,
  p_member_id integer,
  p_kind text,
  p_category text,
  p_type text,
  p_title text,
  p_body text default null,
  p_action_page text default null,
  p_action_label text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_priority text default 'normal',
  p_remind_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_notification_id uuid;
  v_dedupe_key text := nullif(btrim(coalesce(p_dedupe_key, '')), '');
  v_priority text := lower(btrim(coalesce(p_priority, 'normal')));
begin
  if p_tenant_id is null or p_member_id is null or v_dedupe_key is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.member_id = p_member_id
      and tm.status = 'active'
      and lower(coalesce(tm.role, '')) in ('admin', 'superadmin')
  ) then
    perform public.delete_member_notification_by_key(v_dedupe_key);
    return null;
  end if;

  if not coalesce(public.member_allows_notification(p_member_id, p_kind), true) then
    perform public.delete_member_notification_by_key(v_dedupe_key);
    return null;
  end if;

  if v_priority not in ('normal', 'high', 'urgent') then
    v_priority := 'normal';
  end if;

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
  values (
    p_tenant_id,
    p_member_id,
    lower(btrim(coalesce(p_kind, 'system'))),
    lower(btrim(coalesce(p_category, 'admin_watchlist'))),
    lower(btrim(coalesce(p_type, 'notice'))),
    coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'Notification'),
    nullif(btrim(coalesce(p_body, '')), ''),
    nullif(btrim(coalesce(p_action_page, '')), ''),
    nullif(btrim(coalesce(p_action_label, '')), ''),
    nullif(btrim(coalesce(p_entity_type, '')), ''),
    nullif(btrim(coalesce(p_entity_id, '')), ''),
    v_priority,
    'unread',
    null,
    p_remind_at,
    coalesce(p_metadata, '{}'::jsonb),
    v_dedupe_key,
    now(),
    now()
  )
  on conflict (dedupe_key) do update
  set
    tenant_id = excluded.tenant_id,
    member_id = excluded.member_id,
    kind = excluded.kind,
    category = excluded.category,
    type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    action_page = excluded.action_page,
    action_label = excluded.action_label,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    priority = excluded.priority,
    status = case
      when public.member_notifications.title is distinct from excluded.title
        or public.member_notifications.body is distinct from excluded.body
        or public.member_notifications.priority is distinct from excluded.priority
        or public.member_notifications.metadata is distinct from excluded.metadata
      then 'unread'
      else public.member_notifications.status
    end,
    read_at = case
      when public.member_notifications.title is distinct from excluded.title
        or public.member_notifications.body is distinct from excluded.body
        or public.member_notifications.priority is distinct from excluded.priority
        or public.member_notifications.metadata is distinct from excluded.metadata
      then null
      else public.member_notifications.read_at
    end,
    remind_at = excluded.remind_at,
    metadata = excluded.metadata,
    created_at = case
      when public.member_notifications.title is distinct from excluded.title
        or public.member_notifications.body is distinct from excluded.body
        or public.member_notifications.priority is distinct from excluded.priority
        or public.member_notifications.metadata is distinct from excluded.metadata
      then now()
      else public.member_notifications.created_at
    end,
    updated_at = now()
  returning id into v_notification_id;

  return v_notification_id;
end;
$function$;

grant execute on function public.upsert_member_watchlist_notification(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  text
) to authenticated;

create or replace function public.refresh_member_notification_reminders(
  p_tenant_id uuid default null
)
returns table (
  task_due_soon_count integer,
  task_overdue_count integer,
  meeting_reminder_count integer,
  cleared_count integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  reminder_row record;
  cleared_total integer := 0;
  due_soon_total integer := 0;
  overdue_total integer := 0;
  meeting_total integer := 0;
begin
  with cleared as (
    delete from public.member_notifications mn
    where mn.kind = 'task'
      and mn.type in ('task_due_soon', 'task_overdue')
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.project_tasks pt
        join public.tenant_members tm
          on tm.tenant_id = pt.tenant_id
         and tm.member_id = mn.member_id
         and tm.status = 'active'
        where pt.id::text = mn.entity_id
          and pt.assignee_member_id = mn.member_id
          and pt.archived_at is null
          and lower(coalesce(pt.status, 'open')) not in ('done', 'cancelled')
          and pt.due_date is not null
          and (
            (mn.type = 'task_due_soon' and pt.due_date >= current_date and pt.due_date <= current_date + 2)
            or (mn.type = 'task_overdue' and pt.due_date < current_date)
          )
      )
    returning 1
  )
  select count(*) into cleared_total from cleared;

  with cleared as (
    delete from public.member_notifications mn
    where mn.kind = 'meeting'
      and mn.type = 'meeting_reminder'
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.meeting_participants mp
        join public.meetings m
          on m.id = mp.meeting_id
        join public.tenant_members tm
          on tm.tenant_id = m.tenant_id
         and tm.member_id = mn.member_id
         and tm.status = 'active'
        where mp.meeting_id::text = mn.entity_id
          and mp.participant_type = 'member'
          and mp.member_id = mn.member_id
          and lower(coalesce(mp.rsvp_status, 'pending')) <> 'declined'
          and lower(coalesce(mp.attendance_status, 'unknown')) = 'unknown'
          and lower(coalesce(m.status, 'scheduled')) <> 'completed'
          and coalesce(
                m.start_at,
                case
                  when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
                  else null
                end
              ) between now() and (now() + interval '24 hours')
      )
    returning 1
  )
  select cleared_total + count(*) into cleared_total from cleared;

  with cleared as (
    delete from public.member_notifications mn
    where mn.type in ('admin_pending_invites', 'admin_overdue_tasks', 'admin_minutes_pending')
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.tenant_members tm
        where tm.tenant_id = mn.tenant_id
          and tm.member_id = mn.member_id
          and tm.status = 'active'
          and lower(coalesce(tm.role, '')) in ('admin', 'superadmin')
      )
    returning 1
  )
  select cleared_total + count(*) into cleared_total from cleared;

  with cleared as (
    delete from public.member_notifications mn
    where mn.type = 'admin_pending_invites'
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.tenant_members admin_tm
        join lateral (
          select count(*)::integer as pending_count
          from public.member_invites mi
          where (
              mi.tenant_id = admin_tm.tenant_id
              or (
                mi.tenant_id is null
                and exists (
                  select 1
                  from public.tenant_members creator_tm
                  where creator_tm.member_id = mi.created_by
                    and creator_tm.tenant_id = admin_tm.tenant_id
                    and creator_tm.status = 'active'
                    and lower(coalesce(creator_tm.role, '')) in ('admin', 'superadmin')
                )
              )
            )
            and lower(coalesce(mi.status, 'pending')) = 'pending'
        ) invite_summary on true
        where admin_tm.tenant_id = mn.tenant_id
          and admin_tm.member_id = mn.member_id
          and admin_tm.status = 'active'
          and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
          and invite_summary.pending_count > 0
      )
    returning 1
  )
  select cleared_total + count(*) into cleared_total from cleared;

  with cleared as (
    delete from public.member_notifications mn
    where mn.type = 'admin_overdue_tasks'
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.tenant_members admin_tm
        join lateral (
          select count(*)::integer as overdue_count
          from public.project_tasks pt
          where pt.tenant_id = admin_tm.tenant_id
            and pt.archived_at is null
            and lower(coalesce(pt.status, 'open')) not in ('done', 'cancelled')
            and pt.due_date is not null
            and pt.due_date < current_date
        ) task_summary on true
        where admin_tm.tenant_id = mn.tenant_id
          and admin_tm.member_id = mn.member_id
          and admin_tm.status = 'active'
          and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
          and task_summary.overdue_count > 0
      )
    returning 1
  )
  select cleared_total + count(*) into cleared_total from cleared;

  with cleared as (
    delete from public.member_notifications mn
    where mn.type = 'admin_minutes_pending'
      and (p_tenant_id is null or mn.tenant_id = p_tenant_id)
      and not exists (
        select 1
        from public.tenant_members admin_tm
        join lateral (
          select count(*)::integer as meeting_count
          from public.meetings m
          where m.tenant_id = admin_tm.tenant_id
            and lower(coalesce(m.minutes_status, 'draft')) = 'draft'
            and lower(coalesce(m.status, 'scheduled')) <> 'cancelled'
            and coalesce(
                  m.end_at,
                  m.start_at,
                  case
                    when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
                    else null
                  end
                ) < now()
        ) meeting_summary on true
        where admin_tm.tenant_id = mn.tenant_id
          and admin_tm.member_id = mn.member_id
          and admin_tm.status = 'active'
          and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
          and meeting_summary.meeting_count > 0
      )
    returning 1
  )
  select cleared_total + count(*) into cleared_total from cleared;

  for reminder_row in
    select
      pt.id,
      pt.tenant_id,
      pt.assignee_member_id as member_id,
      coalesce(nullif(btrim(pt.title), ''), 'Untitled task') as task_title,
      pt.due_date,
      coalesce(nullif(btrim(pt.priority), ''), 'normal') as priority,
      coalesce(nullif(btrim(p.name), ''), 'Project') as project_name
    from public.project_tasks pt
    join public.iga_projects p
      on p.id = pt.project_id
    join public.tenant_members tm
      on tm.tenant_id = pt.tenant_id
     and tm.member_id = pt.assignee_member_id
     and tm.status = 'active'
    where pt.assignee_member_id is not null
      and pt.archived_at is null
      and (p_tenant_id is null or pt.tenant_id = p_tenant_id)
      and lower(coalesce(pt.status, 'open')) not in ('done', 'cancelled')
      and pt.due_date is not null
      and pt.due_date >= current_date
      and pt.due_date <= current_date + 2
  loop
    perform public.delete_member_notification_by_key(
      format('task-overdue:%s:%s', reminder_row.id, reminder_row.member_id)
    );

    perform public.upsert_member_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'task',
      'tasks',
      'task_due_soon',
      'Task due soon: ' || reminder_row.task_title,
      reminder_row.project_name || ' | Due ' || to_char(reminder_row.due_date, 'DD Mon YYYY'),
      'projects',
      'Open task',
      'project_task',
      reminder_row.id::text,
      case
        when reminder_row.due_date = current_date then 'high'
        when lower(reminder_row.priority) = 'urgent' then 'urgent'
        when lower(reminder_row.priority) = 'high' then 'high'
        else 'normal'
      end,
      reminder_row.due_date::timestamptz,
      jsonb_build_object(
        'project_name', reminder_row.project_name,
        'due_date', reminder_row.due_date,
        'priority', reminder_row.priority
      ),
      format('task-due-soon:%s:%s', reminder_row.id, reminder_row.member_id)
    );
    due_soon_total := due_soon_total + 1;
  end loop;

  for reminder_row in
    select
      pt.id,
      pt.tenant_id,
      pt.assignee_member_id as member_id,
      coalesce(nullif(btrim(pt.title), ''), 'Untitled task') as task_title,
      pt.due_date,
      coalesce(nullif(btrim(pt.priority), ''), 'normal') as priority,
      coalesce(nullif(btrim(p.name), ''), 'Project') as project_name
    from public.project_tasks pt
    join public.iga_projects p
      on p.id = pt.project_id
    join public.tenant_members tm
      on tm.tenant_id = pt.tenant_id
     and tm.member_id = pt.assignee_member_id
     and tm.status = 'active'
    where pt.assignee_member_id is not null
      and pt.archived_at is null
      and (p_tenant_id is null or pt.tenant_id = p_tenant_id)
      and lower(coalesce(pt.status, 'open')) not in ('done', 'cancelled')
      and pt.due_date is not null
      and pt.due_date < current_date
  loop
    perform public.delete_member_notification_by_key(
      format('task-due-soon:%s:%s', reminder_row.id, reminder_row.member_id)
    );

    perform public.upsert_member_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'task',
      'tasks',
      'task_overdue',
      'Task overdue: ' || reminder_row.task_title,
      reminder_row.project_name || ' | Due ' || to_char(reminder_row.due_date, 'DD Mon YYYY'),
      'projects',
      'Open task',
      'project_task',
      reminder_row.id::text,
      'urgent',
      reminder_row.due_date::timestamptz,
      jsonb_build_object(
        'project_name', reminder_row.project_name,
        'due_date', reminder_row.due_date,
        'priority', reminder_row.priority
      ),
      format('task-overdue:%s:%s', reminder_row.id, reminder_row.member_id)
    );
    overdue_total := overdue_total + 1;
  end loop;

  for reminder_row in
    select
      m.id,
      m.tenant_id,
      mp.member_id,
      coalesce(nullif(btrim(m.title), ''), nullif(btrim(m.agenda), ''), 'Meeting') as meeting_title,
      coalesce(
        m.start_at,
        case
          when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
          else null
        end
      ) as meeting_start_at,
      nullif(btrim(coalesce(m.location, '')), '') as meeting_location
    from public.meeting_participants mp
    join public.meetings m
      on m.id = mp.meeting_id
    join public.tenant_members tm
      on tm.tenant_id = m.tenant_id
     and tm.member_id = mp.member_id
     and tm.status = 'active'
    where mp.participant_type = 'member'
      and mp.member_id is not null
      and (p_tenant_id is null or m.tenant_id = p_tenant_id)
      and lower(coalesce(mp.rsvp_status, 'pending')) <> 'declined'
      and lower(coalesce(mp.attendance_status, 'unknown')) = 'unknown'
      and lower(coalesce(m.status, 'scheduled')) <> 'completed'
      and coalesce(
            m.start_at,
            case
              when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
              else null
            end
          ) between now() and (now() + interval '24 hours')
  loop
    perform public.upsert_member_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'meeting',
      'meetings',
      'meeting_reminder',
      'Meeting starts soon: ' || reminder_row.meeting_title,
      to_char(reminder_row.meeting_start_at, 'DD Mon YYYY HH12:MI AM')
      || case when reminder_row.meeting_location is not null then ' | ' || reminder_row.meeting_location else '' end,
      'meetings',
      'Open meeting',
      'meeting',
      reminder_row.id::text,
      'high',
      reminder_row.meeting_start_at,
      jsonb_build_object(
        'meeting_start_at', reminder_row.meeting_start_at,
        'location', reminder_row.meeting_location
      ),
      format('meeting-reminder:%s:%s', reminder_row.id, reminder_row.member_id)
    );
    meeting_total := meeting_total + 1;
  end loop;

  for reminder_row in
    select
      admin_tm.tenant_id,
      admin_tm.member_id,
      invite_summary.pending_count,
      invite_summary.expiring_soon_count,
      invite_summary.next_expiry
    from public.tenant_members admin_tm
    join lateral (
      select
        count(*)::integer as pending_count,
        count(*) filter (
          where mi.expires_at is not null
            and mi.expires_at > now()
            and mi.expires_at <= now() + interval '3 days'
        )::integer as expiring_soon_count,
        min(mi.expires_at) filter (where mi.expires_at is not null and mi.expires_at > now()) as next_expiry
      from public.member_invites mi
      where (
          mi.tenant_id = admin_tm.tenant_id
          or (
            mi.tenant_id is null
            and exists (
              select 1
              from public.tenant_members creator_tm
              where creator_tm.member_id = mi.created_by
                and creator_tm.tenant_id = admin_tm.tenant_id
                and creator_tm.status = 'active'
                and lower(coalesce(creator_tm.role, '')) in ('admin', 'superadmin')
            )
          )
        )
        and lower(coalesce(mi.status, 'pending')) = 'pending'
    ) invite_summary on true
    where admin_tm.status = 'active'
      and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
      and (p_tenant_id is null or admin_tm.tenant_id = p_tenant_id)
      and invite_summary.pending_count > 0
  loop
    perform public.upsert_member_watchlist_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'system',
      'admin_watchlist',
      'admin_pending_invites',
      case
        when reminder_row.pending_count = 1 then '1 pending invite needs follow-up'
        else reminder_row.pending_count::text || ' pending invites need follow-up'
      end,
      trim(
        both ' '
        from
          case
            when reminder_row.expiring_soon_count > 0 then
              reminder_row.expiring_soon_count::text || ' expiring soon'
              || case
                   when reminder_row.next_expiry is not null
                     then ' | Next expiry ' || to_char(reminder_row.next_expiry, 'DD Mon YYYY')
                   else ''
                 end
            else 'Workspace invites are still waiting for acceptance.'
          end
      ),
      'members',
      'Review invites',
      'tenant_watchlist',
      reminder_row.tenant_id::text,
      case when reminder_row.expiring_soon_count > 0 then 'high' else 'normal' end,
      reminder_row.next_expiry,
      jsonb_build_object(
        'pending_invites', reminder_row.pending_count,
        'expiring_soon', reminder_row.expiring_soon_count,
        'next_expiry', reminder_row.next_expiry
      ),
      format('admin-watchlist:pending-invites:%s:%s', reminder_row.tenant_id, reminder_row.member_id)
    );
  end loop;

  for reminder_row in
    select
      admin_tm.tenant_id,
      admin_tm.member_id,
      task_summary.overdue_count,
      task_summary.project_count,
      task_summary.oldest_due_date
    from public.tenant_members admin_tm
    join lateral (
      select
        count(*)::integer as overdue_count,
        count(distinct pt.project_id)::integer as project_count,
        min(pt.due_date) as oldest_due_date
      from public.project_tasks pt
      where pt.tenant_id = admin_tm.tenant_id
        and pt.archived_at is null
        and lower(coalesce(pt.status, 'open')) not in ('done', 'cancelled')
        and pt.due_date is not null
        and pt.due_date < current_date
    ) task_summary on true
    where admin_tm.status = 'active'
      and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
      and (p_tenant_id is null or admin_tm.tenant_id = p_tenant_id)
      and task_summary.overdue_count > 0
  loop
    perform public.upsert_member_watchlist_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'task',
      'admin_watchlist',
      'admin_overdue_tasks',
      case
        when reminder_row.overdue_count = 1 then '1 workspace task is overdue'
        else reminder_row.overdue_count::text || ' workspace tasks are overdue'
      end,
      trim(
        both ' '
        from
          reminder_row.project_count::text
          || ' project'
          || case when reminder_row.project_count = 1 then '' else 's' end
          || ' affected'
          || case
               when reminder_row.oldest_due_date is not null
                 then ' | Oldest due ' || to_char(reminder_row.oldest_due_date, 'DD Mon YYYY')
               else ''
             end
      ),
      'projects',
      'Review overdue tasks',
      'tenant_watchlist',
      reminder_row.tenant_id::text,
      'urgent',
      reminder_row.oldest_due_date::timestamptz,
      jsonb_build_object(
        'overdue_tasks', reminder_row.overdue_count,
        'project_count', reminder_row.project_count,
        'oldest_due_date', reminder_row.oldest_due_date
      ),
      format('admin-watchlist:overdue-tasks:%s:%s', reminder_row.tenant_id, reminder_row.member_id)
    );
  end loop;

  for reminder_row in
    select
      admin_tm.tenant_id,
      admin_tm.member_id,
      meeting_summary.meeting_count,
      meeting_summary.completed_count,
      meeting_summary.oldest_pending_at
    from public.tenant_members admin_tm
    join lateral (
      select
        count(*)::integer as meeting_count,
        count(*) filter (where lower(coalesce(m.status, 'scheduled')) = 'completed')::integer as completed_count,
        min(
          coalesce(
            m.end_at,
            m.start_at,
            case
              when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
              else null
            end
          )
        ) as oldest_pending_at
      from public.meetings m
      where m.tenant_id = admin_tm.tenant_id
        and lower(coalesce(m.minutes_status, 'draft')) = 'draft'
        and lower(coalesce(m.status, 'scheduled')) <> 'cancelled'
        and coalesce(
              m.end_at,
              m.start_at,
              case
                when m.date is not null then (m.date::timestamp + interval '12 hours')::timestamptz
                else null
              end
            ) < now()
    ) meeting_summary on true
    where admin_tm.status = 'active'
      and lower(coalesce(admin_tm.role, '')) in ('admin', 'superadmin')
      and (p_tenant_id is null or admin_tm.tenant_id = p_tenant_id)
      and meeting_summary.meeting_count > 0
  loop
    perform public.upsert_member_watchlist_notification(
      reminder_row.tenant_id,
      reminder_row.member_id,
      'meeting',
      'admin_watchlist',
      'admin_minutes_pending',
      case
        when reminder_row.meeting_count = 1 then '1 meeting still has draft minutes'
        else reminder_row.meeting_count::text || ' meetings still have draft minutes'
      end,
      trim(
        both ' '
        from
          case
            when reminder_row.completed_count > 0 then
              reminder_row.completed_count::text || ' completed meeting'
              || case when reminder_row.completed_count = 1 then '' else 's' end
              || ' waiting'
            else 'Finalize governance records'
          end
          || case
               when reminder_row.oldest_pending_at is not null
                 then ' | Oldest from ' || to_char(reminder_row.oldest_pending_at, 'DD Mon YYYY')
               else ''
             end
      ),
      'meetings',
      'Finalize minutes',
      'tenant_watchlist',
      reminder_row.tenant_id::text,
      'high',
      reminder_row.oldest_pending_at,
      jsonb_build_object(
        'pending_minutes', reminder_row.meeting_count,
        'completed_pending', reminder_row.completed_count,
        'oldest_pending_at', reminder_row.oldest_pending_at
      ),
      format('admin-watchlist:minutes-pending:%s:%s', reminder_row.tenant_id, reminder_row.member_id)
    );
  end loop;

  return query
  select due_soon_total, overdue_total, meeting_total, cleared_total;
end;
$function$;

grant execute on function public.refresh_member_notification_reminders(uuid) to authenticated;
