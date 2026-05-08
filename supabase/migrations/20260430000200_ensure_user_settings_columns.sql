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

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  default_server text not null default 'americas',
  market_tax numeric not null default 0.065,
  has_albion_premium boolean not null default false,
  main_city text,
  update_interval_minutes integer default 10,
  interface_density text not null default 'comfortable',
  currency text default 'prata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings
add column if not exists id uuid default gen_random_uuid(),
add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid(),
add column if not exists default_server text default 'americas',
add column if not exists market_tax numeric default 0.065,
add column if not exists has_albion_premium boolean default false,
add column if not exists main_city text,
add column if not exists update_interval_minutes integer default 10,
add column if not exists interface_density text default 'comfortable',
add column if not exists currency text default 'prata',
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

update public.user_settings
set
  id = coalesce(id, gen_random_uuid()),
  user_id = coalesce(user_id, auth.uid()),
  default_server = coalesce(default_server, 'americas'),
  market_tax = coalesce(market_tax, 0.065),
  has_albion_premium = coalesce(has_albion_premium, false),
  update_interval_minutes = coalesce(update_interval_minutes, 10),
  interface_density = coalesce(interface_density, 'comfortable'),
  currency = coalesce(currency, 'prata'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.user_settings
alter column id set default gen_random_uuid(),
alter column id set not null,
alter column user_id set default auth.uid(),
alter column user_id set not null,
alter column default_server set default 'americas',
alter column default_server set not null,
alter column market_tax set default 0.065,
alter column market_tax set not null,
alter column has_albion_premium set default false,
alter column has_albion_premium set not null,
alter column update_interval_minutes set default 10,
alter column interface_density set default 'comfortable',
alter column interface_density set not null,
alter column currency set default 'prata',
alter column created_at set default now(),
alter column created_at set not null,
alter column updated_at set default now(),
alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_default_server_check'
  ) then
    alter table public.user_settings
    add constraint user_settings_default_server_check
    check (default_server in ('americas', 'europe'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_interface_density_check'
  ) then
    alter table public.user_settings
    add constraint user_settings_interface_density_check
    check (interface_density in ('comfortable', 'compact'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_user_id_key'
  ) then
    alter table public.user_settings
    add constraint user_settings_user_id_key unique (user_id);
  end if;
end;
$$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_crud_own" on public.user_settings;
create policy "user_settings_crud_own" on public.user_settings
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
