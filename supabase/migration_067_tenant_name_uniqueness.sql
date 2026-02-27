-- Migration 067: Enforce unique tenant workspace names (case/whitespace-insensitive)
-- 1) Normalize existing names
-- 2) Resolve current duplicates deterministically
-- 3) Add unique index on normalized name expression

begin;

-- Normalize spacing and trim.
update public.tenants
set name = regexp_replace(btrim(coalesce(name, '')), '\s+', ' ', 'g')
where name is not null;

-- Guardrail for legacy blank names.
update public.tenants
set name = coalesce(nullif(regexp_replace(btrim(coalesce(name, '')), '\s+', ' ', 'g'), ''), slug)
where name is null
   or btrim(name) = '';

-- Resolve existing duplicates by appending unique slug markers for trailing rows.
with ranked as (
  select
    t.id,
    t.name,
    t.slug,
    row_number() over (
      partition by lower(regexp_replace(btrim(t.name), '\s+', ' ', 'g'))
      order by t.created_at asc, t.id asc
    ) as rn
  from public.tenants t
),
dupes as (
  select
    r.id,
    regexp_replace(btrim(r.name), '\s+', ' ', 'g') || ' [' || r.slug || ']' as deduped_name
  from ranked r
  where r.rn > 1
)
update public.tenants t
set
  name = d.deduped_name,
  updated_at = now()
from dupes d
where t.id = d.id;

-- Keep name non-empty after all transforms.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_name_not_blank_check'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_name_not_blank_check
      check (length(btrim(name)) > 0);
  end if;
end;
$$;

-- Enforce uniqueness on normalized workspace name.
create unique index if not exists tenants_name_normalized_unique_idx
  on public.tenants ((lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))));

commit;
