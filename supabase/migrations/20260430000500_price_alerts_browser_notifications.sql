alter table public.price_alerts
add column if not exists last_checked_at timestamptz,
add column if not exists last_triggered_at timestamptz,
add column if not exists last_price numeric,
add column if not exists status text not null default 'waiting',
add column if not exists browser_notification_enabled boolean not null default false;

alter table public.user_settings
add column if not exists browser_notifications_enabled boolean not null default false;

update public.price_alerts
set status = case
  when status in ('hit', 'triggered') then 'triggered'
  when status in ('no_data', 'error', 'waiting') then status
  else 'waiting'
end;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'price_alerts'
      and constraint_name = 'price_alerts_condition_check'
  ) then
    alter table public.price_alerts drop constraint price_alerts_condition_check;
  end if;
end $$;

update public.price_alerts
set condition = case
  when condition = 'greater_than' then 'above'
  when condition = 'less_than' then 'below'
  else condition
end;

alter table public.price_alerts
add constraint price_alerts_condition_check
check (condition in ('below', 'above'));

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'price_alerts'
      and constraint_name = 'price_alerts_status_check'
  ) then
    alter table public.price_alerts drop constraint price_alerts_status_check;
  end if;
end $$;

alter table public.price_alerts
add constraint price_alerts_status_check
check (status in ('waiting', 'triggered', 'no_data', 'error'));

create index if not exists price_alerts_user_status_idx on public.price_alerts(user_id, status);
create index if not exists price_alerts_user_active_idx on public.price_alerts(user_id, active);

drop policy if exists "price_alerts_crud_own" on public.price_alerts;
create policy "price_alerts_crud_own" on public.price_alerts
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

drop trigger if exists price_alerts_enforce_insert_limit on public.price_alerts;
create trigger price_alerts_enforce_insert_limit before insert or update of active on public.price_alerts
for each row execute function public.enforce_insert_limit('price_alerts');
