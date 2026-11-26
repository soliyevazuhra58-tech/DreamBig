-- DreamBig database schema. Run in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_name text not null check (char_length(last_name) between 1 and 60),
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  date_of_birth date not null,
  gender text not null check (gender in ('female','male','other','prefer_not_to_say')),
  card_id text not null unique default ('DB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_created_idx on public.posts(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

-- Private profile data is only readable/writable by its owner.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Anyone can read public posts. Only the signed-in author can create a post.
drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts" on public.posts for select to anon, authenticated using (true);
drop policy if exists "Users can publish own posts" on public.posts;
create policy "Users can publish own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);

-- Expose only safe fields publicly; birthday, surname and gender remain private.
create or replace view public.public_profiles as
select id, first_name, username, card_id, created_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- Feed view joins public profile details without exposing private profile columns.
create or replace view public.public_feed as
select p.id, p.message, p.created_at, p.user_id,
       pr.first_name, pr.username, pr.card_id
from public.posts p
join public.profiles pr on pr.id = p.user_id;

grant select on public.public_feed to anon, authenticated;

-- Server-side cooldown: serializes concurrent attempts per user and checks 24 hours.
create or replace function public.enforce_post_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_post timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select max(created_at) into latest_post
  from public.posts where user_id = new.user_id;

  if latest_post is not null and latest_post > now() - interval '24 hours' then
    raise exception 'You can publish one motivational post every 24 hours.'
      using errcode = 'P0001';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists posts_24_hour_cooldown on public.posts;
create trigger posts_24_hour_cooldown
before insert on public.posts
for each row execute function public.enforce_post_cooldown();

-- Authenticated users may read their own posts for cooldown UI.
