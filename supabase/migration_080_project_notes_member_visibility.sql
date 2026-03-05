-- Migration 080: Project note member-level visibility
--
-- Goals:
-- 1) Allow owner-only and specific-member note visibility.
-- 2) Keep org admins/superadmins with guaranteed access.
-- 3) Preserve project-level access checks via existing helpers.

alter table if exists public.project_notes
  add column if not exists visible_member_ids integer[] not null default '{}'::integer[];

update public.project_notes
set visible_member_ids = '{}'::integer[]
where visible_member_ids is null;

alter table public.project_notes
  drop constraint if exists project_notes_visibility_chk;

alter table public.project_notes
  add constraint project_notes_visibility_chk
  check (visibility in ('project_team', 'admins_only', 'owner_only', 'selected_members'));

alter table public.project_notes
  drop constraint if exists project_notes_visible_members_not_null_chk;

alter table public.project_notes
  add constraint project_notes_visible_members_not_null_chk
  check (visible_member_ids is not null and array_position(visible_member_ids, null) is null);

alter table public.project_notes
  drop constraint if exists project_notes_selected_members_not_empty_chk;

alter table public.project_notes
  add constraint project_notes_selected_members_not_empty_chk
  check (
    coalesce(visibility, 'project_team') <> 'selected_members'
    or coalesce(array_length(visible_member_ids, 1), 0) > 0
  );

create index if not exists project_notes_visible_members_gin_idx
  on public.project_notes using gin (visible_member_ids);

create or replace function public.can_admin_access_iga_project(p_project_id integer)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.iga_projects p
    join public.members m
      on m.auth_id = auth.uid()
    left join public.tenant_members tm
      on tm.member_id = m.id
     and tm.tenant_id = p.tenant_id
     and tm.status = 'active'
    where p.id = p_project_id
      and (
        m.role in ('admin', 'superadmin')
        or tm.role in ('admin', 'superadmin')
      )
  );
$$;

grant execute on function public.can_admin_access_iga_project(integer) to authenticated;

drop policy if exists "Authenticated can view project notes" on public.project_notes;
drop policy if exists rls_project_notes_read on public.project_notes;

create policy rls_project_notes_read
on public.project_notes
for select
to authenticated
using (
  public.can_access_iga_project(project_id)
  and (
    coalesce(visibility, 'project_team') = 'project_team'
    or (
      coalesce(visibility, 'project_team') = 'admins_only'
      and public.can_admin_access_iga_project(project_id)
    )
    or (
      coalesce(visibility, 'project_team') = 'owner_only'
      and (
        public.can_admin_access_iga_project(project_id)
        or exists (
          select 1
          from public.members m
          where m.auth_id = auth.uid()
            and m.id = project_notes.author_member_id
        )
      )
    )
    or (
      coalesce(visibility, 'project_team') = 'selected_members'
      and (
        public.can_admin_access_iga_project(project_id)
        or exists (
          select 1
          from public.members m
          where m.auth_id = auth.uid()
            and (
              m.id = project_notes.author_member_id
              or m.id = any(coalesce(project_notes.visible_member_ids, '{}'::integer[]))
            )
        )
      )
    )
  )
);
