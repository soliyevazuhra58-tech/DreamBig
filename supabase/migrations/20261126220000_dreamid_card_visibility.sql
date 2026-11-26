-- DreamID public visibility settings. The private mirror is never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter table public.profiles
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists visibility jsonb not null default '{"avatar_url":true,"first_name":true,"last_name":false,"username":true,"date_of_birth":false,"gender":false,"country":false,"city":false,"bio":true,"created_at":true}'::jsonb;
create table if not exists private.dreamid_public_profiles (
 id uuid primary key references public.profiles(id) on delete cascade,
 avatar_url text, first_name text, last_name text, username text, date_of_birth date,
 gender text, country text, city text, bio text, created_at timestamptz,
 visibility jsonb not null default '{}'::jsonb
);
revoke all on private.dreamid_public_profiles from public, anon, authenticated;
create or replace function public.sync_dreamid_public_profile()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
 insert into private.dreamid_public_profiles
 (id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility)
 values (new.id,new.avatar_url,new.first_name,new.last_name,new.username,new.date_of_birth,new.gender,new.country,new.city,new.bio,new.created_at,new.visibility)
 on conflict (id) do update set avatar_url=excluded.avatar_url,first_name=excluded.first_name,
 last_name=excluded.last_name,username=excluded.username,date_of_birth=excluded.date_of_birth,
 gender=excluded.gender,country=excluded.country,city=excluded.city,bio=excluded.bio,
 created_at=excluded.created_at,visibility=excluded.visibility;
 return new;
end $$;
revoke execute on function public.sync_dreamid_public_profile() from public, anon, authenticated;
drop trigger if exists profiles_sync_dreamid_public on public.profiles;
create trigger profiles_sync_dreamid_public
after insert or update of avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility
on public.profiles for each row execute function public.sync_dreamid_public_profile();
insert into private.dreamid_public_profiles
(id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility)
select id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility
from public.profiles on conflict (id) do update set
 avatar_url=excluded.avatar_url,first_name=excluded.first_name,last_name=excluded.last_name,
 username=excluded.username,date_of_birth=excluded.date_of_birth,gender=excluded.gender,
 country=excluded.country,city=excluded.city,bio=excluded.bio,created_at=excluded.created_at,
 visibility=excluded.visibility;
drop trigger if exists profiles_sync_public on public.profiles;
drop function if exists public.sync_public_profile();
drop view if exists public.public_feed;
drop view if exists public.dreamid_public;
drop table if exists public.public_profiles;
create view private.dreamid_public as
select id,
 case when coalesce((visibility->>'avatar_url')::boolean,false) then avatar_url end as avatar_url,
 case when coalesce((visibility->>'first_name')::boolean,false) then first_name end as first_name,
 case when coalesce((visibility->>'last_name')::boolean,false) then last_name end as last_name,
 case when coalesce((visibility->>'username')::boolean,false) then username end as username,
 case when coalesce((visibility->>'date_of_birth')::boolean,false) then date_of_birth end as date_of_birth,
 case when coalesce((visibility->>'gender')::boolean,false) then gender end as gender,
 case when coalesce((visibility->>'country')::boolean,false) then country end as country,
 case when coalesce((visibility->>'city')::boolean,false) then city end as city,
 case when coalesce((visibility->>'bio')::boolean,false) then bio end as bio,
 case when coalesce((visibility->>'created_at')::boolean,false) then created_at end as created_at
from private.dreamid_public_profiles;
grant select on private.dreamid_public to anon, authenticated;
create view public.public_feed with (security_invoker = true) as
select p.id,p.message,p.created_at,p.user_id,d.first_name,d.username,null::text as card_id
from public.posts p join private.dreamid_public d on d.id=p.user_id;
grant select on public.public_feed to anon, authenticated;
