-- DreamBig: case-insensitive usernames and full user moderation
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists ban_reason text,
  add column if not exists banned_until timestamptz,
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_private boolean not null default false,
  add column if not exists last_seen_at timestamptz;

create or replace function public.normalize_dreambig_username()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.username := lower(btrim(new.username));
  return new;
end; $$;
drop trigger if exists profiles_normalize_username on public.profiles;
create trigger profiles_normalize_username before insert or update of username on public.profiles
for each row execute function public.normalize_dreambig_username();

create unique index if not exists profiles_username_case_insensitive_key on public.profiles (lower(username));

create or replace function public.protect_profile_moderation_fields()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and not public.is_dreambig_admin() then
    if tg_op = 'INSERT' then
      new.is_banned := false;
      new.is_verified := false;
      new.ban_reason := null;
      new.banned_until := null;
    else
      if new.is_banned is distinct from old.is_banned
        or new.is_verified is distinct from old.is_verified
        or new.ban_reason is distinct from old.ban_reason
        or new.banned_until is distinct from old.banned_until then
        raise exception 'Moderation fields can only be changed by DreamBig admins.' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_protect_moderation_fields on public.profiles;
create trigger profiles_protect_moderation_fields before insert or update on public.profiles
for each row execute function public.protect_profile_moderation_fields();

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated
using (public.is_dreambig_admin());
drop policy if exists "Admins can moderate profiles" on public.profiles;
create policy "Admins can moderate profiles" on public.profiles for update to authenticated
using (public.is_dreambig_admin()) with check (public.is_dreambig_admin());

drop policy if exists "Users can publish own posts" on public.posts;
create policy "Users can publish own posts" on public.posts for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_banned = false)
);

create or replace view public.public_feed as
select p.id, p.message, p.created_at, p.user_id, d.first_name, d.username,
       null::text as card_id, coalesce(u.is_verified,false) as is_verified
from public.posts p
join private.dreamid_public d on d.id = p.user_id
join public.profiles u on u.id = p.user_id
where u.is_banned = false and u.is_private = false;

grant select on public.public_feed to anon, authenticated;
