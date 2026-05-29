create extension if not exists pgcrypto;

create table if not exists public.streamer_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  email text null,
  promotion_code text not null unique,
  stripe_promotion_code_id text null unique,
  stripe_coupon_id text null,
  active boolean not null default true,
  commission_type text null,
  commission_value numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streamer_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  streamer_partner_id uuid references public.streamer_partners(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  promotion_code text not null,
  stripe_promotion_code_id text null,
  stripe_coupon_id text null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_checkout_session_id text null unique,
  amount_subtotal integer null,
  amount_discount integer null,
  amount_total integer null,
  currency text null,
  status text null,
  created_at timestamptz not null default now()
);

create index if not exists streamer_coupon_redemptions_partner_idx
on public.streamer_coupon_redemptions(streamer_partner_id);

create index if not exists streamer_coupon_redemptions_promotion_code_idx
on public.streamer_coupon_redemptions(promotion_code);

create index if not exists streamer_coupon_redemptions_user_id_idx
on public.streamer_coupon_redemptions(user_id);

create index if not exists streamer_coupon_redemptions_subscription_idx
on public.streamer_coupon_redemptions(stripe_subscription_id);

create index if not exists streamer_coupon_redemptions_created_at_idx
on public.streamer_coupon_redemptions(created_at);

drop trigger if exists streamer_partners_set_updated_at on public.streamer_partners;
create trigger streamer_partners_set_updated_at before update on public.streamer_partners
for each row execute function public.set_updated_at();

alter table public.streamer_partners enable row level security;
alter table public.streamer_coupon_redemptions enable row level security;

revoke all on table public.streamer_partners from anon, authenticated;
revoke all on table public.streamer_coupon_redemptions from anon, authenticated;
grant all on table public.streamer_partners to service_role;
grant all on table public.streamer_coupon_redemptions to service_role;
