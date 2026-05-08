alter table public.user_settings
add column if not exists has_albion_premium boolean not null default false;
