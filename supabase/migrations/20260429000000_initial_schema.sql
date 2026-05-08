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
  has_albion_premium boolean not null default false,
  main_city text,
  update_interval_minutes integer default 10,
  interface_density text not null default 'comfortable' check (interface_density in ('comfortable', 'compact')),
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
  condition text not null check (condition in ('less_than', 'greater_than')),
  active boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  page text not null,
  filters jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_regear_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  server text not null check (server in ('americas', 'europe')),
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_player_name_idx on public.profiles(player_name);
create index if not exists trader_operations_user_id_idx on public.trader_operations(user_id);
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists weapon_listings_user_id_idx on public.weapon_listings(user_id);
create index if not exists weapon_listings_server_status_idx on public.weapon_listings(server, status);
create index if not exists chat_messages_channel_created_at_idx on public.chat_messages(channel, created_at);
create index if not exists price_alerts_user_id_idx on public.price_alerts(user_id);
create index if not exists saved_filters_user_page_idx on public.saved_filters(user_id, page);
create index if not exists saved_regear_builds_user_id_idx on public.saved_regear_builds(user_id);

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

drop trigger if exists saved_regear_builds_set_updated_at on public.saved_regear_builds;
create trigger saved_regear_builds_set_updated_at before update on public.saved_regear_builds
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.trader_operations enable row level security;
alter table public.favorites enable row level security;
alter table public.weapon_listings enable row level security;
alter table public.chat_messages enable row level security;
alter table public.price_alerts enable row level security;
alter table public.saved_filters enable row level security;
alter table public.saved_regear_builds enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id and plan = 'free' and subscription_status = 'free');

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

drop policy if exists "saved_filters_crud_own" on public.saved_filters;
create policy "saved_filters_crud_own" on public.saved_filters
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_regear_builds_crud_own" on public.saved_regear_builds;
create policy "saved_regear_builds_crud_own" on public.saved_regear_builds
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

create or replace function public.is_active_pro_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = target_user_id
      and plan = 'pro'
      and subscription_status = 'active'
  );
$$;

create or replace function public.entitlement_limit(target_user_id uuid, feature text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_pro boolean := public.is_active_pro_user(target_user_id);
begin
  if feature = 'favorites' then
    return case when is_pro then 1000000000 else 10 end;
  elsif feature = 'trader_operations' then
    return case when is_pro then 1000000000 else 50 end;
  elsif feature = 'weapon_listings' then
    return case when is_pro then 20 else 3 end;
  elsif feature = 'price_alerts' then
    return case when is_pro then 50 else 0 end;
  elsif feature = 'saved_filters' then
    return case when is_pro then 20 else 1 end;
  elsif feature = 'saved_regear_builds' then
    return case when is_pro then 20 else 1 end;
  end if;

  return 0;
end;
$$;

create or replace function public.prevent_profile_plan_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and coalesce(auth.role(), '') = 'authenticated' then
    if new.plan <> 'free' or new.subscription_status <> 'free' then
      raise exception 'Plano e status de assinatura nao podem ser definidos pelo usuario.';
    end if;
  end if;

  if tg_op = 'UPDATE' and coalesce(auth.role(), '') = 'authenticated' then
    if (
      old.plan is distinct from new.plan
      or old.subscription_status is distinct from new.subscription_status
    ) then
      raise exception 'Plano e status de assinatura nao podem ser alterados pelo usuario.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_plan_self_update on public.profiles;
create trigger profiles_prevent_plan_self_update before insert or update on public.profiles
for each row execute function public.prevent_profile_plan_self_update();

create or replace function public.enforce_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_allowed integer;
  feature_name text := tg_argv[0];
begin
  max_allowed := public.entitlement_limit(new.user_id, feature_name);

  if feature_name = 'weapon_listings' then
    if new.status = 'sold' then
      return new;
    end if;

    select count(*) into current_count
    from public.weapon_listings
    where user_id = new.user_id
      and status <> 'sold'
      and (tg_op = 'INSERT' or id <> new.id);
  elsif feature_name = 'trader_operations' then
    select count(*) into current_count
    from public.trader_operations
    where user_id = new.user_id
      and (tg_op = 'INSERT' or id <> new.id);
  elsif feature_name = 'favorites' then
    select count(*) into current_count
    from public.favorites
    where user_id = new.user_id
      and (tg_op = 'INSERT' or id <> new.id);
  elsif feature_name = 'price_alerts' then
    select count(*) into current_count
    from public.price_alerts
    where user_id = new.user_id
      and (tg_op = 'INSERT' or id <> new.id);
  elsif feature_name = 'saved_filters' then
    select count(*) into current_count
    from public.saved_filters
    where user_id = new.user_id
      and (tg_op = 'INSERT' or id <> new.id);
  elsif feature_name = 'saved_regear_builds' then
    select count(*) into current_count
    from public.saved_regear_builds
    where user_id = new.user_id
      and (tg_op = 'INSERT' or id <> new.id);
  else
    raise exception 'Feature de limite desconhecida: %', feature_name;
  end if;

  if current_count >= max_allowed then
    raise exception 'Limite do plano atingido para %. Limite: %', feature_name, max_allowed;
  end if;

  return new;
end;
$$;

drop trigger if exists favorites_enforce_insert_limit on public.favorites;
create trigger favorites_enforce_insert_limit before insert on public.favorites
for each row execute function public.enforce_insert_limit('favorites');

drop trigger if exists trader_operations_enforce_insert_limit on public.trader_operations;
create trigger trader_operations_enforce_insert_limit before insert on public.trader_operations
for each row execute function public.enforce_insert_limit('trader_operations');

drop trigger if exists weapon_listings_enforce_insert_limit on public.weapon_listings;
create trigger weapon_listings_enforce_insert_limit before insert or update of status on public.weapon_listings
for each row execute function public.enforce_insert_limit('weapon_listings');

drop trigger if exists price_alerts_enforce_insert_limit on public.price_alerts;
create trigger price_alerts_enforce_insert_limit before insert on public.price_alerts
for each row execute function public.enforce_insert_limit('price_alerts');

drop trigger if exists saved_filters_enforce_insert_limit on public.saved_filters;
create trigger saved_filters_enforce_insert_limit before insert on public.saved_filters
for each row execute function public.enforce_insert_limit('saved_filters');

drop trigger if exists saved_regear_builds_enforce_insert_limit on public.saved_regear_builds;
create trigger saved_regear_builds_enforce_insert_limit before insert on public.saved_regear_builds
for each row execute function public.enforce_insert_limit('saved_regear_builds');

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
