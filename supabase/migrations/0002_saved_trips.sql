-- 0002_saved_trips.sql
-- Adds saved trip plans (AI itineraries). ADDITIVE ONLY: no existing table, column, policy or
-- function from 0001_init.sql is changed or dropped. Safe to re-run.

create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination_slug text not null check (char_length(destination_slug) between 1 and 64),
  kind text not null default 'itinerary'
    check (kind in ('itinerary', 'packing', 'phrasebook', 'essentials')),
  title text not null check (char_length(title) between 1 and 200),
  language text not null default 'en' check (char_length(language) between 2 and 8),
  -- The generated plan, and the choices (days, interests, pace, budget) that produced it.
  data jsonb not null check (pg_column_size(data) <= 200000),
  options jsonb check (options is null or pg_column_size(options) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_trips_user_created_idx
  on public.saved_trips (user_id, created_at desc);
create index if not exists saved_trips_user_slug_idx
  on public.saved_trips (user_id, destination_slug, created_at desc);

-- Keep updated_at honest on edits. search_path is pinned like the other functions.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_trips_set_updated_at on public.saved_trips;
create trigger saved_trips_set_updated_at
  before update on public.saved_trips
  for each row execute function public.set_updated_at();

alter table public.saved_trips enable row level security;

drop policy if exists "saved_trips_select_own" on public.saved_trips;
create policy "saved_trips_select_own" on public.saved_trips
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_insert_own" on public.saved_trips;
create policy "saved_trips_insert_own" on public.saved_trips
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_update_own" on public.saved_trips;
create policy "saved_trips_update_own" on public.saved_trips
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_delete_own" on public.saved_trips;
create policy "saved_trips_delete_own" on public.saved_trips
  for delete to authenticated
  using ((select auth.uid()) = user_id);
