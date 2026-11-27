-- Reserve @owner and allow one-time secure owner activation from a signed-in DreamID.
create table if not exists public.dreambig_reserved_usernames (
  username text primary key,
  reserved_for uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.dreambig_reserved_usernames enable row level security;
revoke all on public.dreambig_reserved_usernames from anon, authenticated;
insert into public.dreambig_reserved_usernames(username,reserved_for)
values ('owner',null) on conflict (username) do nothing;

create table if not exists public.dreambig_owner_claim (
  id boolean primary key default true check (id),
  token_hash text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);
alter table public.dreambig_owner_claim enable row level security;
revoke all on public.dreambig_owner_claim from anon, authenticated;
insert into public.dreambig_owner_claim(id,token_hash) values (true,null) on conflict (id) do nothing;
-- Provision the one-time token hash directly in Supabase, never in source control.

create or replace function public.guard_dreambig_reserved_username()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed_user uuid;
begin
  select reserved_for into allowed_user from public.dreambig_reserved_usernames where username=lower(btrim(new.username));
  if found and allowed_user is distinct from new.id then
    raise exception 'This username is reserved by DreamBig.' using errcode='23505';
  end if;
  return new;
end; $$;
revoke all on function public.guard_dreambig_reserved_username() from public,anon,authenticated;
drop trigger if exists profiles_z_guard_reserved_username on public.profiles;
create trigger profiles_z_guard_reserved_username before insert or update of username on public.profiles
for each row execute function public.guard_dreambig_reserved_username();

create or replace function public.claim_dreambig_owner(p_token_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_claim public.dreambig_owner_claim%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  select * into current_claim from public.dreambig_owner_claim where id=true for update;
  if not found or current_claim.claimed_by is not null or current_claim.token_hash is distinct from p_token_hash then
    raise exception 'Owner activation code is invalid or already used.' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Create a DreamID before claiming owner access.' using errcode='P0002';
  end if;
  if exists(select 1 from public.profiles where lower(username)='owner' and id<>auth.uid()) then
    raise exception '@owner username is already in use.' using errcode='23505';
  end if;
  update public.dreambig_reserved_usernames set reserved_for=auth.uid() where username='owner';
  update public.profiles set username='owner' where id=auth.uid();
  insert into public.dreambig_admins(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.dreambig_owner_claim set token_hash=null,claimed_by=auth.uid(),claimed_at=now() where id=true;
  return true;
end; $$;
revoke all on function public.claim_dreambig_owner(text) from public,anon;
grant execute on function public.claim_dreambig_owner(text) to authenticated;
