-- Migration 028: Storage bucket + policies for tenant logo uploads

-- Ensure bucket exists and is public
insert into storage.buckets (id, name, public)
values ('tenant-logo', 'tenant-logo', true)
on conflict (id) do update
set name = excluded.name,
    public = true;

-- Enable RLS on storage objects (safe if already enabled)
alter table storage.objects enable row level security;

drop policy if exists "Public read tenant logos" on storage.objects;
drop policy if exists "Public upload tenant logos" on storage.objects;

-- Allow anyone to read public tenant logos
create policy "Public read tenant logos"
on storage.objects
for select
to public
using (bucket_id = 'tenant-logo');

-- Allow public uploads to the tenant-logo bucket
create policy "Public upload tenant logos"
on storage.objects
for insert
to public
with check (bucket_id = 'tenant-logo');
