begin;

alter table public.meetings
  add column if not exists audience_scope text not null default 'selected_members',
  add column if not exists agenda_items jsonb not null default '[]'::jsonb,
  add column if not exists minutes_data jsonb not null default '{}'::jsonb,
  add column if not exists chairperson_member_id integer references public.members(id) on delete set null,
  add column if not exists secretary_member_id integer references public.members(id) on delete set null,
  add column if not exists minutes_status text not null default 'draft',
  add column if not exists minutes_generated_at timestamptz;

alter table public.meetings
  drop constraint if exists meetings_audience_scope_chk;
alter table public.meetings
  add constraint meetings_audience_scope_chk
  check (audience_scope in ('selected_members', 'all_members'));

alter table public.meetings
  drop constraint if exists meetings_minutes_status_chk;
alter table public.meetings
  add constraint meetings_minutes_status_chk
  check (minutes_status in ('draft', 'finalized'));

alter table public.meetings
  drop constraint if exists meetings_agenda_items_is_array_chk;
alter table public.meetings
  add constraint meetings_agenda_items_is_array_chk
  check (jsonb_typeof(agenda_items) = 'array');

alter table public.meetings
  drop constraint if exists meetings_minutes_data_is_object_chk;
alter table public.meetings
  add constraint meetings_minutes_data_is_object_chk
  check (jsonb_typeof(minutes_data) = 'object');

create index if not exists meetings_minutes_status_idx on public.meetings(tenant_id, minutes_status);
create index if not exists meetings_chairperson_idx on public.meetings(chairperson_member_id);
create index if not exists meetings_secretary_idx on public.meetings(secretary_member_id);

create table if not exists public.meeting_participants (
  id bigserial primary key,
  meeting_id integer not null references public.meetings(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id integer references public.members(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete cascade,
  participant_type text not null,
  rsvp_status text not null default 'pending',
  attendance_status text not null default 'unknown',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  attendance_marked_at timestamptz,
  attendance_marked_by integer references public.members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meeting_participants
  drop constraint if exists meeting_participants_type_ref_chk;
alter table public.meeting_participants
  add constraint meeting_participants_type_ref_chk
  check (
    (
      participant_type = 'member'
      and member_id is not null
      and subscriber_id is null
    )
    or (
      participant_type = 'subscriber'
      and subscriber_id is not null
      and member_id is null
    )
  );

alter table public.meeting_participants
  drop constraint if exists meeting_participants_rsvp_status_chk;
alter table public.meeting_participants
  add constraint meeting_participants_rsvp_status_chk
  check (rsvp_status in ('pending', 'confirmed', 'declined', 'apology'));

alter table public.meeting_participants
  drop constraint if exists meeting_participants_attendance_status_chk;
alter table public.meeting_participants
  add constraint meeting_participants_attendance_status_chk
  check (attendance_status in ('unknown', 'attended', 'absent'));

create index if not exists meeting_participants_meeting_idx
  on public.meeting_participants(meeting_id);
create index if not exists meeting_participants_tenant_idx
  on public.meeting_participants(tenant_id);
create index if not exists meeting_participants_member_idx
  on public.meeting_participants(member_id);
create index if not exists meeting_participants_subscriber_idx
  on public.meeting_participants(subscriber_id);
create index if not exists meeting_participants_rsvp_idx
  on public.meeting_participants(meeting_id, rsvp_status);
create index if not exists meeting_participants_attendance_idx
  on public.meeting_participants(meeting_id, attendance_status);

create unique index if not exists meeting_participants_meeting_member_uq
  on public.meeting_participants(meeting_id, member_id)
  where member_id is not null;

create unique index if not exists meeting_participants_meeting_subscriber_uq
  on public.meeting_participants(meeting_id, subscriber_id)
  where subscriber_id is not null;

create or replace function public.touch_meeting_participants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_meeting_participants_touch_updated_at on public.meeting_participants;
create trigger trg_meeting_participants_touch_updated_at
before update on public.meeting_participants
for each row execute function public.touch_meeting_participants_updated_at();

create or replace function public.can_access_meeting_participant(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select public.can_access_organization_activity(p_tenant_id);
$$;

create or replace function public.can_manage_meeting_participant(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select public.can_manage_organization_activity(p_tenant_id);
$$;

create or replace function public.respond_meeting_invitation(
  p_meeting_id integer,
  p_rsvp_status text
)
returns public.meeting_participants
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  normalized_status text := lower(btrim(coalesce(p_rsvp_status, '')));
  current_member_id integer;
  updated_row public.meeting_participants%rowtype;
begin
  if normalized_status not in ('confirmed', 'declined', 'apology') then
    raise exception 'Invalid RSVP status';
  end if;

  select m.id
  into current_member_id
  from public.members m
  where m.auth_id = auth.uid();

  if current_member_id is null then
    raise exception 'Authenticated member record not found';
  end if;

  update public.meeting_participants mp
  set
    rsvp_status = normalized_status,
    responded_at = now(),
    updated_at = now()
  where mp.meeting_id = p_meeting_id
    and mp.participant_type = 'member'
    and mp.member_id = current_member_id
    and public.can_access_organization_activity(mp.tenant_id)
  returning mp.*
  into updated_row;

  if updated_row.id is null then
    raise exception 'Meeting invitation not found for current member';
  end if;

  return updated_row;
end;
$$;

grant execute on function public.can_access_meeting_participant(uuid) to authenticated;
grant execute on function public.can_manage_meeting_participant(uuid) to authenticated;
grant execute on function public.respond_meeting_invitation(integer, text) to authenticated;

alter table public.meeting_participants enable row level security;

drop policy if exists "Tenant members can view meeting participants" on public.meeting_participants;
create policy "Tenant members can view meeting participants"
on public.meeting_participants
for select
to authenticated
using (public.can_access_meeting_participant(tenant_id));

drop policy if exists "Tenant admins can manage meeting participants" on public.meeting_participants;
create policy "Tenant admins can manage meeting participants"
on public.meeting_participants
for all
to authenticated
using (public.can_manage_meeting_participant(tenant_id))
with check (public.can_manage_meeting_participant(tenant_id));

insert into public.meeting_participants (
  meeting_id,
  tenant_id,
  member_id,
  participant_type,
  rsvp_status,
  attendance_status,
  invited_at
)
select distinct
  m.id,
  m.tenant_id,
  (entry->>'id')::integer as member_id,
  'member',
  'confirmed',
  'attended',
  coalesce(m.created_at, now())
from public.meetings m
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(coalesce(m.attendees_data, '[]'::jsonb)) = 'array'
      then coalesce(m.attendees_data, '[]'::jsonb)
    else '[]'::jsonb
  end
) entry
where coalesce(entry->>'type', 'member') = 'member'
  and nullif(entry->>'id', '') is not null
on conflict do nothing;

insert into public.meeting_participants (
  meeting_id,
  tenant_id,
  subscriber_id,
  participant_type,
  rsvp_status,
  attendance_status,
  invited_at
)
select distinct
  m.id,
  m.tenant_id,
  nullif(entry->>'id', '')::uuid as subscriber_id,
  'subscriber',
  'confirmed',
  'attended',
  coalesce(m.created_at, now())
from public.meetings m
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(coalesce(m.attendees_data, '[]'::jsonb)) = 'array'
      then coalesce(m.attendees_data, '[]'::jsonb)
    else '[]'::jsonb
  end
) entry
where coalesce(entry->>'type', '') = 'subscriber'
  and nullif(entry->>'id', '') is not null
on conflict do nothing;

comment on column public.meetings.audience_scope is 'Meeting invite audience scope. selected_members means the roster is curated; all_members snapshots all current tenant members.';
comment on column public.meetings.agenda_items is 'Structured meeting agenda items for minutes generation.';
comment on column public.meetings.minutes_data is 'Structured minutes payload including preliminaries, resolutions, next meeting, and adjournment.';
comment on column public.meetings.minutes_status is 'Minutes lifecycle state: draft or finalized.';
comment on table public.meeting_participants is 'Invited meeting roster with RSVP and attendance state per member or subscriber.';

commit;
