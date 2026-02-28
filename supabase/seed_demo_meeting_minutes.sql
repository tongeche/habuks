begin;

do $$
declare
  v_tenant_id uuid;
  v_chairperson_id integer;
  v_treasurer_id integer;
  v_secretary_id integer;
  v_meeting_id integer;
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
  into v_chairperson_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and tm.status = 'active'
    and m.name = 'Demo Member'
  limit 1;

  select m.id
  into v_treasurer_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and tm.status = 'active'
    and m.name = 'Demo Treasurer'
  limit 1;

  select m.id
  into v_secretary_id
  from public.tenant_members tm
  join public.members m on m.id = tm.member_id
  where tm.tenant_id = v_tenant_id
    and tm.status = 'active'
    and m.name = 'Demo Secretary'
  limit 1;

  if v_chairperson_id is null or v_treasurer_id is null or v_secretary_id is null then
    raise exception 'Demo tenant members missing. Expected Demo Member, Demo Treasurer, and Demo Secretary.';
  end if;

  delete from public.meetings
  where tenant_id = v_tenant_id
    and title = 'Demo Governing Council Meeting';

  insert into public.meetings (
    tenant_id,
    title,
    type,
    agenda,
    date,
    description,
    location,
    status,
    owner_member_id,
    assignees,
    attendees_data,
    start_at,
    end_at,
    value_type,
    budget_line,
    audience_scope,
    agenda_items,
    minutes_data,
    chairperson_member_id,
    secretary_member_id,
    minutes_status,
    minutes_generated_at
  )
  values (
    v_tenant_id,
    'Demo Governing Council Meeting',
    'Meeting',
    'Quarterly governance, welfare performance, and project operations review.',
    '2026-02-18',
    'A polished demo meeting record with agenda items, resolutions, and participant states for minutes PDF preview.',
    'Demo Hall, Homa Bay',
    'completed',
    v_chairperson_id,
    array[v_chairperson_id, v_secretary_id],
    jsonb_build_array(
      jsonb_build_object('type', 'member', 'id', v_chairperson_id),
      jsonb_build_object('type', 'member', 'id', v_treasurer_id),
      jsonb_build_object('type', 'member', 'id', v_secretary_id)
    ),
    '2026-02-18T09:30:00+03:00',
    '2026-02-18T12:15:00+03:00',
    'Expense',
    'Administration',
    'selected_members',
    jsonb_build_array(
      jsonb_build_object(
        'title', 'Confirmation of previous minutes',
        'details', 'The chairperson invited the secretary to read the previous minutes. Members confirmed that the action log had been implemented except for one delayed supplier follow-up.',
        'resolutions', jsonb_build_array(
          'Previous minutes were confirmed as a true record.',
          'Outstanding supplier follow-up moved to the next executive check-in.'
        )
      ),
      jsonb_build_object(
        'title', 'Welfare collections and arrears review',
        'details', 'The treasurer presented the welfare collections summary for the current cycle and highlighted two members with delayed remittances. Members discussed a softer reminder process before escalation.',
        'resolutions', jsonb_build_array(
          'Treasurer to issue reminder calls by Friday.',
          'Arrears report to be included in the next welfare update.'
        )
      ),
      jsonb_build_object(
        'title', 'Poultry and groundnut project performance',
        'details', 'The council reviewed the brooder utilization rate and groundnut product movement. The committee agreed the poultry unit needs tighter feed variance tracking while the groundnut line needs a stronger Saturday market push.',
        'resolutions', jsonb_build_array(
          'Secretary to prepare a one-page operational dashboard for both projects.',
          'Project leads to submit cost-control actions before the next meeting.'
        )
      ),
      jsonb_build_object(
        'title', 'Partnership and donor readiness',
        'details', 'Members discussed how to package recent activity records and financial summaries into a donor-ready pack. The meeting emphasized consistency in branding and clearer evidence of governance decisions.',
        'resolutions', jsonb_build_array(
          'Demo Member to review the organization profile and donor pack structure.',
          'Meeting minutes to be generated and filed in organization documents after approval.'
        )
      )
    ),
    jsonb_build_object(
      'preliminaries', 'The meeting opened with a word of prayer, introductions of members present, and confirmation that quorum had been achieved. The chairperson outlined the need to close the quarter with clearer documentation and stronger follow-up on finance actions.',
      'previous_minutes', jsonb_build_object(
        'status', 'Confirmed as a true record',
        'notes', 'Members adopted the previous minutes with one note that supplier outreach had been delayed but remained active.'
      ),
      'financial_matters', jsonb_build_object(
        'discussion', 'The treasurer''s written update showed steady contributions but pressure on operating cash due to feed purchases and packaging expenses. Members agreed that procurement timing needs to align more closely with incoming cash.',
        'resolution', 'A weekly cash-position review will be introduced and any expense above the agreed threshold must be reviewed by the chairperson and treasurer before payment.'
      ),
      'next_meeting', jsonb_build_object(
        'date', '2026-03-20',
        'note', 'The next meeting will focus on cycle close-out, donor pack review, and project dashboard adoption.'
      ),
      'adjournment', jsonb_build_object(
        'time', '12:15 PM',
        'note', 'The chairperson thanked members for the disciplined discussion and urged timely follow-through on all assigned actions.'
      )
    ),
    v_chairperson_id,
    v_secretary_id,
    'draft',
    null
  )
  returning id into v_meeting_id;

  insert into public.meeting_participants (
    meeting_id,
    tenant_id,
    member_id,
    participant_type,
    rsvp_status,
    attendance_status,
    invited_at,
    responded_at,
    attendance_marked_at,
    attendance_marked_by,
    notes
  )
  values
    (
      v_meeting_id,
      v_tenant_id,
      v_chairperson_id,
      'member',
      'confirmed',
      'attended',
      '2026-02-12T10:00:00+03:00',
      '2026-02-12T11:15:00+03:00',
      '2026-02-18T09:35:00+03:00',
      v_chairperson_id,
      'Chairperson present and led the session.'
    ),
    (
      v_meeting_id,
      v_tenant_id,
      v_treasurer_id,
      'member',
      'apology',
      'unknown',
      '2026-02-12T10:00:00+03:00',
      '2026-02-17T18:10:00+03:00',
      null,
      null,
      'Sent apologies due to an external procurement visit.'
    ),
    (
      v_meeting_id,
      v_tenant_id,
      v_secretary_id,
      'member',
      'confirmed',
      'attended',
      '2026-02-12T10:00:00+03:00',
      '2026-02-13T08:40:00+03:00',
      '2026-02-18T09:36:00+03:00',
      v_chairperson_id,
      'Secretary present and recorded proceedings.'
    );

  raise notice 'Seeded demo meeting id % for tenant %', v_meeting_id, v_tenant_id;
end $$;

commit;
