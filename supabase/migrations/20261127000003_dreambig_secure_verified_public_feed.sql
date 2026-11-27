-- Keep the public feed safe for anon/authenticated callers while exposing verified status.
alter table private.dreamid_public_profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists is_private boolean not null default false;

create or replace function public.sync_dreamid_public_profile()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  insert into private.dreamid_public_profiles
    (id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility,is_verified,is_banned,is_private)
  values
    (new.id,new.avatar_url,new.first_name,new.last_name,new.username,new.date_of_birth,new.gender,new.country,new.city,new.bio,new.created_at,new.visibility,new.is_verified,new.is_banned,new.is_private)
  on conflict (id) do update set
    avatar_url=excluded.avatar_url, first_name=excluded.first_name, last_name=excluded.last_name,
    username=excluded.username, date_of_birth=excluded.date_of_birth, gender=excluded.gender,
    country=excluded.country, city=excluded.city, bio=excluded.bio, created_at=excluded.created_at,
    visibility=excluded.visibility, is_verified=excluded.is_verified, is_banned=excluded.is_banned,
    is_private=excluded.is_private;
  return new;
end; $$;

insert into private.dreamid_public_profiles
  (id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility,is_verified,is_banned,is_private)
select id,avatar_url,first_name,last_name,username,date_of_birth,gender,country,city,bio,created_at,visibility,is_verified,is_banned,is_private
from public.profiles
on conflict (id) do update set
  avatar_url=excluded.avatar_url, first_name=excluded.first_name, last_name=excluded.last_name,
  username=excluded.username, date_of_birth=excluded.date_of_birth, gender=excluded.gender,
  country=excluded.country, city=excluded.city, bio=excluded.bio, created_at=excluded.created_at,
  visibility=excluded.visibility, is_verified=excluded.is_verified, is_banned=excluded.is_banned,
  is_private=excluded.is_private;

create or replace view private.dreamid_public as
select id,
  case when coalesce((visibility->>'avatar_url')::boolean,false) then avatar_url else null::text end as avatar_url,
  case when coalesce((visibility->>'first_name')::boolean,false) then first_name else null::text end as first_name,
  case when coalesce((visibility->>'last_name')::boolean,false) then last_name else null::text end as last_name,
  case when coalesce((visibility->>'username')::boolean,false) then username else null::text end as username,
  case when coalesce((visibility->>'date_of_birth')::boolean,false) then date_of_birth else null::date end as date_of_birth,
  case when coalesce((visibility->>'gender')::boolean,false) then gender else null::text end as gender,
  case when coalesce((visibility->>'country')::boolean,false) then country else null::text end as country,
  case when coalesce((visibility->>'city')::boolean,false) then city else null::text end as city,
  case when coalesce((visibility->>'bio')::boolean,false) then bio else null::text end as bio,
  case when coalesce((visibility->>'created_at')::boolean,false) then created_at else null::timestamptz end as created_at,
  is_verified,is_banned,is_private
from private.dreamid_public_profiles;

grant usage on schema private to anon,authenticated;
grant select on private.dreamid_public to anon,authenticated;

create or replace view public.public_feed with (security_invoker=true) as
select p.id,p.message,p.created_at,p.user_id,d.first_name,d.username,
       null::text as card_id,coalesce(d.is_verified,false) as is_verified
from public.posts p
join private.dreamid_public d on d.id=p.user_id
where d.is_banned=false and d.is_private=false;
grant select on public.public_feed to anon,authenticated;
