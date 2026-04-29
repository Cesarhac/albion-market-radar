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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  player_name text not null,
  player_id text,
  guild_name text,
  alliance_name text,
  main_server text not null default 'americas' check (main_server in ('americas', 'europe')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  subscription_status text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  default_server text not null default 'americas' check (default_server in ('americas', 'europe')),
  market_tax numeric not null default 0.065,
  main_city text,
  update_interval_minutes integer default 10,
  currency text default 'prata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trader_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('buy', 'sell')),
  item_name text not null,
  item_id text,
  server text check (server in ('americas', 'europe')),
  city text,
  unit_buy_price numeric,
  unit_sell_price numeric,
  unit_price numeric,
  quantity integer not null check (quantity > 0),
  tax_rate numeric,
  related_buy_id uuid,
  related_position_key text,
  is_quick_sale boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_id text not null,
  item_name text not null,
  server text check (server in ('americas', 'europe')),
  target_price numeric,
  city text,
  alert_enabled boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.weapon_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  seller_player_name text not null,
  seller_player_id text,
  weapon_name text not null,
  item_id text,
  tier integer not null check (tier between 4 and 8),
  enchantment integer not null default 4 check (enchantment = 4),
  quality text,
  server text not null check (server in ('Americas', 'Europe')),
  city text,
  asking_price numeric not null check (asking_price > 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  is_awakened boolean default false,
  traits jsonb default '[]'::jsonb,
  suggested_use text,
  description text,
  seller_contact text,
  safety_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  player_name text not null,
  channel text not null,
  content text not null check (char_length(content) <= 300),
  status text not null default 'visible' check (status in ('visible', 'reported', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_id text not null,
  item_name text not null,
  server text not null check (server in ('americas', 'europe')),
  city text,
  target_price numeric not null,
  condition text not null,
  active boolean default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_player_name_idx on public.profiles(player_name);
create index if not exists trader_operations_user_id_idx on public.trader_operations(user_id);
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists weapon_listings_user_id_idx on public.weapon_listings(user_id);
create index if not exists weapon_listings_server_status_idx on public.weapon_listings(server, status);
create index if not exists chat_messages_channel_created_at_idx on public.chat_messages(channel, created_at);
create index if not exists price_alerts_user_id_idx on public.price_alerts(user_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trader_operations_set_updated_at on public.trader_operations;
create trigger trader_operations_set_updated_at before update on public.trader_operations
for each row execute function public.set_updated_at();

drop trigger if exists weapon_listings_set_updated_at on public.weapon_listings;
create trigger weapon_listings_set_updated_at before update on public.weapon_listings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.trader_operations enable row level security;
alter table public.favorites enable row level security;
alter table public.weapon_listings enable row level security;
alter table public.chat_messages enable row level security;
alter table public.price_alerts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "user_settings_crud_own" on public.user_settings;
create policy "user_settings_crud_own" on public.user_settings
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "trader_operations_crud_own" on public.trader_operations;
create policy "trader_operations_crud_own" on public.trader_operations
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "favorites_crud_own" on public.favorites;
create policy "favorites_crud_own" on public.favorites
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "price_alerts_crud_own" on public.price_alerts;
create policy "price_alerts_crud_own" on public.price_alerts
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_read_authenticated" on public.weapon_listings;
create policy "weapon_listings_read_authenticated" on public.weapon_listings
for select to authenticated using (true);

drop policy if exists "weapon_listings_insert_own" on public.weapon_listings;
create policy "weapon_listings_insert_own" on public.weapon_listings
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_update_own" on public.weapon_listings;
create policy "weapon_listings_update_own" on public.weapon_listings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_delete_own" on public.weapon_listings;
create policy "weapon_listings_delete_own" on public.weapon_listings
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "chat_messages_read_visible" on public.chat_messages;
create policy "chat_messages_read_visible" on public.chat_messages
for select to authenticated using (status = 'visible');

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own" on public.chat_messages
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    player_name,
    player_id,
    guild_name,
    alliance_name,
    main_server,
    plan,
    subscription_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'player_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'player_id',
    new.raw_user_meta_data->>'guild_name',
    new.raw_user_meta_data->>'alliance_name',
    coalesce(new.raw_user_meta_data->>'main_server', 'americas'),
    'free',
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    player_name = excluded.player_name,
    player_id = excluded.player_id,
    guild_name = excluded.guild_name,
    alliance_name = excluded.alliance_name,
    main_server = excluded.main_server,
    updated_at = now();

  insert into public.user_settings (user_id, default_server)
  values (new.id, coalesce(new.raw_user_meta_data->>'main_server', 'americas'))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
