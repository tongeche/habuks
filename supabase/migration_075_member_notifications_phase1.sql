-- Migration 075: Member notifications phase 1
--
-- Adds a tenant-scoped in-app notification inbox for the dashboard bell.
-- Phase 1 sources:
-- - project task assignment / reassignment / updates
-- - meeting invitations and meeting updates
-- - meeting minutes ready
-- - organization blog/news updates

create extension if not exists pgcrypto;

create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id integer not null references public.members(id) on delete cascade,
  kind text not null,
  category text not null,
  type text not null,
  title text not null,
  body text,
  action_page text,
  action_label text,
  entity_type text,
  entity_id text,
  priority text not null default 'normal',
  status text not null default 'unread',
  read_at timestamptz,
  remind_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_notifications
  drop constraint if exists member_notifications_kind_chk;
alter table public.member_notifications
  add constraint member_notifications_kind_chk
  check (kind in ('task', 'meeting', 'news', 'system'));

alter table public.member_notifications
  drop constraint if exists member_notifications_priority_chk;
alter table public.member_notifications
  add constraint member_notifications_priority_chk
  check (priority in ('normal', 'high', 'urgent'));

alter table public.member_notifications
  drop constraint if exists member_notifications_status_chk;
alter table public.member_notifications
  add constraint member_notifications_status_chk
  check (status in ('unread', 'read', 'dismissed'));

create unique index if not exists member_notifications_dedupe_uq
  on public.member_notifications (dedupe_key);

create index if not exists member_notifications_member_created_idx
  on public.member_notifications (member_id, created_at desc);

create index if not exists member_notifications_tenant_member_status_idx
  on public.member_notifications (tenant_id, member_id, status, created_at desc);

create or replace function public.touch_member_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_member_notifications_touch_updated_at on public.member_notifications;
create trigger trg_member_notifications_touch_updated_at
before update on public.member_notifications
for each row execute function public.touch_member_notifications_updated_at();

create or replace function public.current_member_id()
returns integer
language sql
security definer
set search_path = public
set row_security = off
as $$
  select m.id
  from public.members m
  where m.auth_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_member_id() to authenticated;

create or replace function public.member_allows_notification(
  p_member_id integer,
  p_kind text
)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    coalesce((m.notification_settings ->> 'in_app_notifications')::boolean, true)
    and case lower(coalesce(p_kind, 'system'))
      when 'task' then coalesce((m.notification_settings ->> 'task_notifications')::boolean, true)
      when 'meeting' then coalesce((m.notification_settings ->> 'meeting_reminders')::boolean, true)
      when 'news' then coalesce((m.notification_settings ->> 'news_updates')::boolean, true)
      else true
    end
  from public.members m
  where m.id = p_member_id
  limit 1;
$$;

grant execute on function public.member_allows_notification(integer, text) to authenticated;

create or replace function public.can_access_member_notification(
  p_member_id integer,
  p_tenant_id uuid
)
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
      and m.id = p_member_id
      and (
        p_tenant_id is null
        or tm.id is not null
        or m.role in ('admin', 'superadmin')
      )
  );
$$;

grant execute on function public.can_access_member_notification(integer, uuid) to authenticated;

alter table public.member_notifications enable row level security;
grant select, update on public.member_notifications to authenticated;

drop policy if exists "Members view own notifications" on public.member_notifications;
create policy "Members view own notifications"
on public.member_notifications
for select
to authenticated
using (public.can_access_member_notification(member_id, tenant_id));

drop policy if exists "Members update own notifications" on public.member_notifications;
create policy "Members update own notifications"
on public.member_notifications
for update
to authenticated
using (public.can_access_member_notification(member_id, tenant_id))
with check (public.can_access_member_notification(member_id, tenant_id));

create or replace function public.delete_member_notification_by_key(p_dedupe_key text)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if nullif(btrim(coalesce(p_dedupe_key, '')), '') is null then
    return;
  end if;

  delete from public.member_notifications
  where dedupe_key = p_dedupe_key;
end;
$$;

grant execute on function public.delete_member_notification_by_key(text) to authenticated;

create or replace function public.upsert_member_notification(
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
  if p_tenant_id is null or p_member_id is null then
    return null;
  end if;

  if v_dedupe_key is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.member_id = p_member_id
      and tm.status = 'active'
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
    lower(btrim(coalesce(p_category, 'general'))),
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
    status = 'unread',
    read_at = null,
    remind_at = excluded.remind_at,
    metadata = excluded.metadata,
    created_at = now(),
    updated_at = now()
  returning id into v_notification_id;

  return v_notification_id;
end;
$function$;

grant execute on function public.upsert_member_notification(
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

create or replace function public.notify_project_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_project_name text;
  v_old_key text;
  v_new_key text;
  v_title text;
  v_body text;
  v_priority text;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.assignee_member_id is not null then
    v_old_key := format('task-assignment:%s:%s', old.id, old.assignee_member_id);

    if tg_op = 'DELETE'
       or old.assignee_member_id is distinct from new.assignee_member_id
       or new.archived_at is not null
       or lower(coalesce(new.status, 'open')) in ('done', 'cancelled') then
      perform public.delete_member_notification_by_key(v_old_key);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.assignee_member_id is null
     or new.archived_at is not null
     or lower(coalesce(new.status, 'open')) in ('done', 'cancelled') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.assignee_member_id is not distinct from new.assignee_member_id
     and coalesce(old.title, '') is not distinct from coalesce(new.title, '')
     and old.due_date is not distinct from new.due_date
     and coalesce(old.priority, '') is not distinct from coalesce(new.priority, '') then
    return new;
  end if;

  select p.name
  into v_project_name
  from public.iga_projects p
  where p.id = new.project_id
  limit 1;

  v_priority := lower(coalesce(new.priority, 'normal'));
  if v_priority not in ('normal', 'high', 'urgent') then
    v_priority := 'normal';
  end if;

  v_new_key := format('task-assignment:%s:%s', new.id, new.assignee_member_id);
  v_title := case
    when tg_op = 'INSERT' or old.assignee_member_id is distinct from new.assignee_member_id
      then 'Task assigned: ' || coalesce(nullif(btrim(new.title), ''), 'Untitled task')
    else 'Task updated: ' || coalesce(nullif(btrim(new.title), ''), 'Untitled task')
  end;
  v_body :=
    coalesce(v_project_name, 'Project')
    || case when new.due_date is not null then ' | Due ' || to_char(new.due_date, 'DD Mon YYYY') else '' end
    || case when nullif(btrim(coalesce(new.priority, '')), '') is not null then ' | Priority ' || initcap(replace(new.priority, '_', ' ')) else '' end;

  perform public.upsert_member_notification(
    new.tenant_id,
    new.assignee_member_id,
    'task',
    'tasks',
    case
      when tg_op = 'INSERT' or old.assignee_member_id is distinct from new.assignee_member_id then 'task_assigned'
      else 'task_updated'
    end,
    v_title,
    v_body,
    'projects',
    'Open task',
    'project_task',
    new.id::text,
    v_priority,
    null,
    jsonb_build_object(
      'project_id', new.project_id,
      'project_name', coalesce(v_project_name, 'Project'),
      'status', new.status,
      'due_date', new.due_date
    ),
    v_new_key
  );

  return new;
end;
$function$;

create or replace function public.notify_meeting_participant_event()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_meeting_title text;
  v_meeting_date date;
  v_meeting_start_at timestamptz;
  v_meeting_location text;
  v_meeting_tenant_id uuid;
  v_old_invite_key text;
  v_old_minutes_key text;
  v_new_invite_key text;
  v_title text;
  v_body text;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.participant_type = 'member'
     and old.member_id is not null then
    v_old_invite_key := format('meeting-invite:%s:%s', old.meeting_id, old.member_id);
    v_old_minutes_key := format('meeting-minutes:%s:%s', old.meeting_id, old.member_id);

    if tg_op = 'DELETE'
       or old.member_id is distinct from new.member_id
       or old.participant_type is distinct from new.participant_type then
      perform public.delete_member_notification_by_key(v_old_invite_key);
      perform public.delete_member_notification_by_key(v_old_minutes_key);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.participant_type <> 'member' or new.member_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.member_id is not distinct from new.member_id
     and old.participant_type is not distinct from new.participant_type then
    return new;
  end if;

  select
    coalesce(nullif(btrim(m.title), ''), nullif(btrim(m.agenda), ''), 'Meeting'),
    m.date,
    m.start_at,
    nullif(btrim(m.location), ''),
    m.tenant_id
  into
    v_meeting_title,
    v_meeting_date,
    v_meeting_start_at,
    v_meeting_location,
    v_meeting_tenant_id
  from public.meetings m
  where m.id = new.meeting_id
  limit 1;

  if v_meeting_tenant_id is null then
    return new;
  end if;

  v_new_invite_key := format('meeting-invite:%s:%s', new.meeting_id, new.member_id);
  v_title := 'Meeting invitation: ' || coalesce(v_meeting_title, 'Meeting');
  v_body :=
    'Scheduled '
    || coalesce(to_char(v_meeting_start_at, 'DD Mon YYYY HH12:MI AM'), to_char(v_meeting_date, 'DD Mon YYYY'), 'Soon')
    || case when v_meeting_location is not null then ' | ' || v_meeting_location else '' end;

  perform public.upsert_member_notification(
    v_meeting_tenant_id,
    new.member_id,
    'meeting',
    'meetings',
    'meeting_invite',
    v_title,
    v_body,
    'meetings',
    'Open meeting',
    'meeting',
    new.meeting_id::text,
    'normal',
    coalesce(v_meeting_start_at, v_meeting_date::timestamptz),
    jsonb_build_object(
      'meeting_id', new.meeting_id,
      'rsvp_status', new.rsvp_status,
      'attendance_status', new.attendance_status,
      'location', v_meeting_location
    ),
    v_new_invite_key
  );

  return new;
end;
$function$;

create or replace function public.notify_meeting_update()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  participant_row record;
  v_title text;
  v_body text;
begin
  if tg_op = 'DELETE' then
    delete from public.member_notifications
    where tenant_id = old.tenant_id
      and entity_type = 'meeting'
      and entity_id = old.id::text;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.title, '') is not distinct from coalesce(new.title, '')
     and old.date is not distinct from new.date
     and old.start_at is not distinct from new.start_at
     and old.end_at is not distinct from new.end_at
     and coalesce(old.location, '') is not distinct from coalesce(new.location, '')
     and coalesce(old.status, '') is not distinct from coalesce(new.status, '')
     and coalesce(old.minutes_status, '') is not distinct from coalesce(new.minutes_status, '') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.minutes_status is distinct from new.minutes_status
     and lower(coalesce(new.minutes_status, 'draft')) = 'finalized' then
    for participant_row in
      select distinct mp.member_id
      from public.meeting_participants mp
      where mp.meeting_id = new.id
        and mp.participant_type = 'member'
        and mp.member_id is not null
    loop
      perform public.upsert_member_notification(
        new.tenant_id,
        participant_row.member_id,
        'meeting',
        'meetings',
        'meeting_minutes_ready',
        'Minutes ready: ' || coalesce(nullif(btrim(new.title), ''), 'Meeting'),
        'Minutes are available for review in Activities.',
        'meetings',
        'Open minutes',
        'meeting',
        new.id::text,
        'normal',
        null,
        jsonb_build_object('meeting_id', new.id, 'minutes_status', new.minutes_status),
        format('meeting-minutes:%s:%s', new.id, participant_row.member_id)
      );
    end loop;
  end if;

  if tg_op = 'UPDATE'
     and (
       coalesce(old.title, '') is distinct from coalesce(new.title, '')
       or old.date is distinct from new.date
       or old.start_at is distinct from new.start_at
       or old.end_at is distinct from new.end_at
       or coalesce(old.location, '') is distinct from coalesce(new.location, '')
       or coalesce(old.status, '') is distinct from coalesce(new.status, '')
     ) then
    v_title := 'Meeting updated: ' || coalesce(nullif(btrim(new.title), ''), 'Meeting');
    v_body :=
      'Now scheduled '
      || coalesce(to_char(new.start_at, 'DD Mon YYYY HH12:MI AM'), to_char(new.date, 'DD Mon YYYY'), 'Soon')
      || case when nullif(btrim(coalesce(new.location, '')), '') is not null then ' | ' || nullif(btrim(coalesce(new.location, '')), '') else '' end;

    for participant_row in
      select distinct mp.member_id
      from public.meeting_participants mp
      where mp.meeting_id = new.id
        and mp.participant_type = 'member'
        and mp.member_id is not null
    loop
      perform public.upsert_member_notification(
        new.tenant_id,
        participant_row.member_id,
        'meeting',
        'meetings',
        'meeting_invite',
        v_title,
        v_body,
        'meetings',
        'Open meeting',
        'meeting',
        new.id::text,
        'normal',
        coalesce(new.start_at, new.date::timestamptz),
        jsonb_build_object(
          'meeting_id', new.id,
          'status', new.status,
          'location', new.location
        ),
        format('meeting-invite:%s:%s', new.id, participant_row.member_id)
      );
    end loop;
  end if;

  return new;
end;
$function$;

create or replace function public.notify_blog_update()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  member_row record;
  v_title text;
  v_excerpt text;
begin
  if tg_op = 'DELETE' then
    delete from public.member_notifications
    where tenant_id = old.tenant_id
      and entity_type = 'blog'
      and entity_id = old.id::text;
    return old;
  end if;

  if new.tenant_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.title, '') is not distinct from coalesce(new.title, '')
     and coalesce(old.content, '') is not distinct from coalesce(new.content, '')
     and coalesce(old.type, '') is not distinct from coalesce(new.type, '')
     and old.date_posted is not distinct from new.date_posted
     and old.tenant_id is not distinct from new.tenant_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.tenant_id is distinct from new.tenant_id then
    delete from public.member_notifications
    where tenant_id = old.tenant_id
      and entity_type = 'blog'
      and entity_id = old.id::text;
  end if;

  v_title := 'Organization update: ' || coalesce(nullif(btrim(new.title), ''), 'Update');
  v_excerpt := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 180);

  for member_row in
    select tm.member_id
    from public.tenant_members tm
    where tm.tenant_id = new.tenant_id
      and tm.status = 'active'
  loop
    perform public.upsert_member_notification(
      new.tenant_id,
      member_row.member_id,
      'news',
      'updates',
      'news_update',
      v_title,
      nullif(v_excerpt, ''),
      'news',
      'Open updates',
      'blog',
      new.id::text,
      'normal',
      new.date_posted,
      jsonb_build_object(
        'blog_type', new.type,
        'date_posted', new.date_posted
      ),
      format('news:%s:%s', new.id, member_row.member_id)
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists trg_project_tasks_notify_assignment on public.project_tasks;
create trigger trg_project_tasks_notify_assignment
after insert or update or delete on public.project_tasks
for each row execute function public.notify_project_task_assignment();

drop trigger if exists trg_meeting_participants_notify_event on public.meeting_participants;
create trigger trg_meeting_participants_notify_event
after insert or update or delete on public.meeting_participants
for each row execute function public.notify_meeting_participant_event();

drop trigger if exists trg_meetings_notify_update on public.meetings;
create trigger trg_meetings_notify_update
after update or delete on public.meetings
for each row execute function public.notify_meeting_update();

drop trigger if exists trg_blogs_notify_update on public.blogs;
create trigger trg_blogs_notify_update
after insert or update or delete on public.blogs
for each row execute function public.notify_blog_update();
