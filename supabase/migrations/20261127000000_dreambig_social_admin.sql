-- DreamBig account editing, post ownership and admin moderation
alter table public.profiles add column if not exists dreamid_changed_at timestamptz;

create or replace function public.enforce_dreamid_weekly_edit()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if (new.first_name, new.last_name, new.username, new.date_of_birth, new.gender, new.country, new.city, new.bio)
     is distinct from
     (old.first_name, old.last_name, old.username, old.date_of_birth, old.gender, old.country, old.city, old.bio) then
    if old.dreamid_changed_at is not null and old.dreamid_changed_at > now() - interval '7 days' then
      raise exception 'DreamID can only be changed once every 7 days.' using errcode='P0001';
    end if;
    new.dreamid_changed_at := now();
  end if;
  return new;
end; $$;
drop trigger if exists profiles_dreamid_weekly_edit on public.profiles;
create trigger profiles_dreamid_weekly_edit before update on public.profiles
for each row execute function public.enforce_dreamid_weekly_edit();

create table if not exists public.dreambig_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.dreambig_admins enable row level security;
revoke all on public.dreambig_admins from anon, authenticated;
create policy "Admins can read their own admin flag" on public.dreambig_admins
for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.dreambig_admins to authenticated;

create or replace function public.is_dreambig_admin()
returns boolean language sql stable security invoker set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.dreambig_admins where user_id=auth.uid());
$$;
revoke all on function public.is_dreambig_admin() from public, anon;
grant execute on function public.is_dreambig_admin() to authenticated;

drop policy if exists "Users can edit own posts" on public.posts;
create policy "Users can edit own posts" on public.posts for update to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts for delete to authenticated
using ((select auth.uid())=user_id or public.is_dreambig_admin());

-- To grant admin access, run once in Supabase SQL Editor after replacing the UUID:
-- insert into public.dreambig_admins(user_id) values ('YOUR_AUTH_USER_UUID');
