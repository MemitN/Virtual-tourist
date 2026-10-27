-- 0001_init.sql
-- AI Virtual Tourism: profiles, favorites, chat history, storage bucket.
-- RLS is enabled on every table. Safe to re-run (idempotent where practical).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-create a profile whenever a user signs up (magic link included).
-- SECURITY DEFINER so it can write regardless of RLS; search_path is pinned
-- to avoid search-path hijacking.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Traveler'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination_slug text not null check (char_length(destination_slug) between 1 and 64),
  created_at timestamptz not null default now(),
  -- One favorite per destination per user; makes optimistic adds idempotent.
  unique (user_id, destination_slug)
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- chat_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination_slug text not null check (char_length(destination_slug) between 1 and 64),
  created_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_slug_idx
  on public.chat_sessions (user_id, destination_slug, created_at desc);

alter table public.chat_sessions enable row level security;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own" on public.chat_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- chat_messages (access granted through ownership of the parent session)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at asc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_via_session" on public.chat_messages;
create policy "chat_messages_select_via_session" on public.chat_messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = (select auth.uid())
  ));

drop policy if exists "chat_messages_insert_via_session" on public.chat_messages;
create policy "chat_messages_insert_via_session" on public.chat_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = (select auth.uid())
  ));

drop policy if exists "chat_messages_delete_via_session" on public.chat_messages;
create policy "chat_messages_delete_via_session" on public.chat_messages
  for delete to authenticated
  using (exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id
      and s.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Storage: public bucket for generated panoramas.
-- Reads are public via the bucket's public URL; writes happen server-side with
-- the service role key (which bypasses RLS), so no client write policies exist.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('panoramas', 'panoramas', true)
on conflict (id) do nothing;
