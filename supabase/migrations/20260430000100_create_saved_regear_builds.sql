create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.saved_regear_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  server text not null default 'americas',
  items jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_regear_builds
add column if not exists user_id uuid references auth.users(id) on delete cascade,
add column if not exists name text,
add column if not exists server text default 'americas',
add column if not exists items jsonb default '{}'::jsonb,
add column if not exists notes text,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

update public.saved_regear_builds
set
  server = coalesce(server, 'americas'),
  items = coalesce(items, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.saved_regear_builds
alter column user_id drop default,
alter column user_id set not null,
alter column name set not null,
alter column server set default 'americas',
alter column server set not null,
alter column items set default '{}'::jsonb,
alter column items set not null,
alter column created_at set default now(),
alter column created_at set not null,
alter column updated_at set default now(),
alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.saved_regear_builds'::regclass
      and conname = 'saved_regear_builds_server_check'
  ) then
    alter table public.saved_regear_builds
    add constraint saved_regear_builds_server_check
    check (server in ('americas', 'europe'));
  end if;
end;
$$;

create index if not exists saved_regear_builds_user_id_idx
on public.saved_regear_builds(user_id);

drop trigger if exists saved_regear_builds_set_updated_at on public.saved_regear_builds;
create trigger saved_regear_builds_set_updated_at
before update on public.saved_regear_builds
for each row execute function public.set_updated_at();

alter table public.saved_regear_builds enable row level security;

drop policy if exists "saved_regear_builds_crud_own" on public.saved_regear_builds;
drop policy if exists "saved_regear_builds_select_own" on public.saved_regear_builds;
drop policy if exists "saved_regear_builds_insert_own" on public.saved_regear_builds;
drop policy if exists "saved_regear_builds_update_own" on public.saved_regear_builds;
drop policy if exists "saved_regear_builds_delete_own" on public.saved_regear_builds;

create policy "saved_regear_builds_select_own" on public.saved_regear_builds
for select to authenticated
using (auth.uid() = user_id);

create policy "saved_regear_builds_insert_own" on public.saved_regear_builds
for insert to authenticated
with check (auth.uid() = user_id);

create policy "saved_regear_builds_update_own" on public.saved_regear_builds
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "saved_regear_builds_delete_own" on public.saved_regear_builds
for delete to authenticated
using (auth.uid() = user_id);
