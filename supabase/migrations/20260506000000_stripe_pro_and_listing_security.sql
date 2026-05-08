alter table public.profiles
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists stripe_price_id text,
add column if not exists subscription_current_period_end timestamptz;

create index if not exists profiles_stripe_customer_id_idx on public.profiles(stripe_customer_id);
create index if not exists profiles_stripe_subscription_id_idx on public.profiles(stripe_subscription_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (
  auth.uid() = id
  and plan = 'free'
  and subscription_status = 'free'
  and stripe_customer_id is null
  and stripe_subscription_id is null
  and stripe_price_id is null
  and subscription_current_period_end is null
);

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
      and subscription_status in ('active', 'trialing', 'past_due')
      and (
        subscription_current_period_end is null
        or subscription_current_period_end > now()
      )
  );
$$;

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
    if max_allowed <= 0 then
      raise exception 'Alertas de preco sao exclusivos PRO.';
    end if;

    if new.active is not true then
      return new;
    end if;

    select count(*) into current_count
    from public.price_alerts
    where user_id = new.user_id
      and active is true
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

create or replace function public.prevent_profile_plan_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and coalesce(auth.role(), '') = 'authenticated' then
    if (
      new.plan <> 'free'
      or new.subscription_status <> 'free'
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.stripe_price_id is not null
      or new.subscription_current_period_end is not null
    ) then
      raise exception 'Campos de assinatura nao podem ser definidos pelo usuario.';
    end if;
  end if;

  if tg_op = 'UPDATE' and coalesce(auth.role(), '') = 'authenticated' then
    if (
      old.plan is distinct from new.plan
      or old.subscription_status is distinct from new.subscription_status
      or old.stripe_customer_id is distinct from new.stripe_customer_id
      or old.stripe_subscription_id is distinct from new.stripe_subscription_id
      or old.stripe_price_id is distinct from new.stripe_price_id
      or old.subscription_current_period_end is distinct from new.subscription_current_period_end
    ) then
      raise exception 'Campos de assinatura nao podem ser alterados pelo usuario.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_plan_self_update on public.profiles;
create trigger profiles_prevent_plan_self_update before insert or update on public.profiles
for each row execute function public.prevent_profile_plan_self_update();

drop policy if exists "weapon_listings_read_authenticated" on public.weapon_listings;
create policy "weapon_listings_read_authenticated" on public.weapon_listings
for select to authenticated
using (true);

drop policy if exists "weapon_listings_insert_own" on public.weapon_listings;
create policy "weapon_listings_insert_own" on public.weapon_listings
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_update_own" on public.weapon_listings;
create policy "weapon_listings_update_own" on public.weapon_listings
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_delete_own" on public.weapon_listings;
create policy "weapon_listings_delete_own" on public.weapon_listings
for delete to authenticated
using (auth.uid() = user_id);
