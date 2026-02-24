-- Migration 047: Add member bio field for richer member profiles

alter table public.members
  add column if not exists avatar_url text,
  add column if not exists bio text;
