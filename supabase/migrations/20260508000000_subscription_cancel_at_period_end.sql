alter table public.profiles
add column if not exists subscription_cancel_at_period_end boolean not null default false,
add column if not exists subscription_cancel_at timestamptz;

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
  and subscription_cancel_at_period_end is false
  and subscription_cancel_at is null
);

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
      or new.subscription_cancel_at_period_end is not false
      or new.subscription_cancel_at is not null
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
      or old.subscription_cancel_at_period_end is distinct from new.subscription_cancel_at_period_end
      or old.subscription_cancel_at is distinct from new.subscription_cancel_at
    ) then
      raise exception 'Campos de assinatura nao podem ser alterados pelo usuario.';
    end if;
  end if;

  return new;
end;
$$;
