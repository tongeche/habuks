-- Migration 076: Member notification reminders phase 2
--
-- Adds a refresh RPC for time-based reminders:
-- - tasks due soon
-- - overdue tasks
-- - meetings starting soon
--
-- This function can be called by a scheduler later, and the dashboard bell
-- can also invoke it opportunistically in development or low-traffic setups.

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

  return query
  select due_soon_total, overdue_total, meeting_total, cleared_total;
end;
$function$;

grant execute on function public.refresh_member_notification_reminders(uuid) to authenticated;
