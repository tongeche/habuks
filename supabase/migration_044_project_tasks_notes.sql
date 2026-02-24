-- Migration 044: Project tasks and notes (tenant + project scoped)
-- Goals:
-- 1) Add dedicated project task and note tables for dashboard tabs.
-- 2) Keep tenant_id synchronized from project_id.
-- 3) Enforce RLS using existing IGA access helpers.

create extension if not exists pgcrypto;

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.iga_projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  title text not null,
  details text,
  assignee_member_id integer references public.members(id) on delete set null,
  due_date date,
  priority text not null default 'normal',
  status text not null default 'open',
  created_by_member_id integer references public.members(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.project_tasks
  drop constraint if exists project_tasks_title_not_blank_chk;

alter table public.project_tasks
  add constraint project_tasks_title_not_blank_chk
  check (length(btrim(title)) > 0);

alter table public.project_tasks
  drop constraint if exists project_tasks_priority_chk;

alter table public.project_tasks
  add constraint project_tasks_priority_chk
  check (priority in ('normal', 'high', 'urgent'));

alter table public.project_tasks
  drop constraint if exists project_tasks_status_chk;

alter table public.project_tasks
  add constraint project_tasks_status_chk
  check (status in ('open', 'in_progress', 'done', 'cancelled'));

create index if not exists project_tasks_project_idx
  on public.project_tasks (project_id);

create index if not exists project_tasks_tenant_idx
  on public.project_tasks (tenant_id);

create index if not exists project_tasks_project_active_due_idx
  on public.project_tasks (project_id, archived_at, due_date, created_at);

create index if not exists project_tasks_assignee_idx
  on public.project_tasks (assignee_member_id);

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.iga_projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  title text not null,
  body text,
  visibility text not null default 'project_team',
  author_member_id integer references public.members(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.project_notes
  drop constraint if exists project_notes_title_not_blank_chk;

alter table public.project_notes
  add constraint project_notes_title_not_blank_chk
  check (length(btrim(title)) > 0);

alter table public.project_notes
  drop constraint if exists project_notes_visibility_chk;

alter table public.project_notes
  add constraint project_notes_visibility_chk
  check (visibility in ('project_team', 'admins_only'));

create index if not exists project_notes_project_idx
  on public.project_notes (project_id);

create index if not exists project_notes_tenant_idx
  on public.project_notes (tenant_id);

create index if not exists project_notes_project_active_created_idx
  on public.project_notes (project_id, archived_at, created_at);

create index if not exists project_notes_author_idx
  on public.project_notes (author_member_id);

create or replace function public.set_project_task_note_tenant_id()
returns trigger
language plpgsql
as $$
declare
  v_tenant_id uuid;
begin
  if new.project_id is null then
    new.tenant_id := null;
    return new;
  end if;

  select p.tenant_id
    into v_tenant_id
  from public.iga_projects p
  where p.id = new.project_id;

  if not found then
    raise foreign_key_violation using message = format('Invalid project_id: %s', new.project_id);
  end if;

  new.tenant_id := v_tenant_id;
  return new;
end;
$$;

drop trigger if exists trg_project_tasks_set_tenant on public.project_tasks;
create trigger trg_project_tasks_set_tenant
before insert or update on public.project_tasks
for each row execute function public.set_project_task_note_tenant_id();

drop trigger if exists trg_project_notes_set_tenant on public.project_notes;
create trigger trg_project_notes_set_tenant
before insert or update on public.project_notes
for each row execute function public.set_project_task_note_tenant_id();

create or replace function public.touch_project_task_note_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_project_tasks_touch_updated_at on public.project_tasks;
create trigger trg_project_tasks_touch_updated_at
before update on public.project_tasks
for each row execute function public.touch_project_task_note_updated_at();

drop trigger if exists trg_project_notes_touch_updated_at on public.project_notes;
create trigger trg_project_notes_touch_updated_at
before update on public.project_notes
for each row execute function public.touch_project_task_note_updated_at();

alter table public.project_tasks enable row level security;
alter table public.project_notes enable row level security;

drop policy if exists "Authenticated can view project tasks" on public.project_tasks;
create policy "Authenticated can view project tasks"
on public.project_tasks
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage project tasks" on public.project_tasks;
create policy "Project managers can manage project tasks"
on public.project_tasks
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

drop policy if exists "Authenticated can view project notes" on public.project_notes;
create policy "Authenticated can view project notes"
on public.project_notes
for select
to authenticated
using (public.can_access_iga_project(project_id));

drop policy if exists "Project managers can manage project notes" on public.project_notes;
create policy "Project managers can manage project notes"
on public.project_notes
for all
to authenticated
using (public.can_manage_iga_project(project_id))
with check (public.can_manage_iga_project(project_id));

