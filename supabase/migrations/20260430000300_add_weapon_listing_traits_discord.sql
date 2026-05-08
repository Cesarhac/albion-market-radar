alter table public.weapon_listings
add column if not exists item_power integer,
add column if not exists attunement_points integer,
add column if not exists invested_cost numeric,
add column if not exists trait_tags text[] not null default '{}'::text[],
add column if not exists awakened boolean not null default false,
add column if not exists awakened_level integer,
add column if not exists discord_username text,
add column if not exists discord_user_id text,
add column if not exists discord_invite_url text;

update public.weapon_listings
set awakened = coalesce(is_awakened, false)
where awakened is distinct from coalesce(is_awakened, false);

alter table public.weapon_listings enable row level security;

drop policy if exists "weapon_listings_read_authenticated" on public.weapon_listings;
drop policy if exists "weapon_listings_read_available_public" on public.weapon_listings;
create policy "weapon_listings_read_available_public" on public.weapon_listings
for select to anon, authenticated using (status = 'available');

drop policy if exists "weapon_listings_read_own" on public.weapon_listings;
create policy "weapon_listings_read_own" on public.weapon_listings
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "weapon_listings_insert_own" on public.weapon_listings;
create policy "weapon_listings_insert_own" on public.weapon_listings
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_update_own" on public.weapon_listings;
create policy "weapon_listings_update_own" on public.weapon_listings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weapon_listings_delete_own" on public.weapon_listings;
create policy "weapon_listings_delete_own" on public.weapon_listings
for delete to authenticated using (auth.uid() = user_id);
