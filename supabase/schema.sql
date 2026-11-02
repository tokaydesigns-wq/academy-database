-- Academy Database: tables and privacy rules.
-- Paste this whole file into Supabase > SQL Editor and press Run. It is safe to run again.
--
-- Who can see what:
--   * Only people whose email is in the "staff" table can read or change members.
--   * Visitors who aren't signed in (the "anon" role) can't touch anything.
--   * Members are never deleted from the app, only marked inactive.

-- Staff list. The owner adds staff emails here in the Table Editor.
create table if not exists public.staff (
  email text primary key check (email = lower(email)),
  name text not null default '',
  added_at timestamptz not null default now()
);

-- True when the signed-in person's email is on the staff list.
-- "security definer" lets it read the staff table without opening that table up.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff where email = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.staff enable row level security;
drop policy if exists "staff read staff" on public.staff;
create policy "staff read staff" on public.staff
  for select to authenticated using (public.is_staff());

-- Members: contact info and emergency contact.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  address text not null default '',
  emergency_name text not null default '',
  emergency_phone text not null default '',
  emergency_relation text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.members enable row level security;
drop policy if exists "staff read members" on public.members;
drop policy if exists "staff add members" on public.members;
drop policy if exists "staff edit members" on public.members;
create policy "staff read members" on public.members
  for select to authenticated using (public.is_staff());
create policy "staff add members" on public.members
  for insert to authenticated with check (public.is_staff());
create policy "staff edit members" on public.members
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- No delete policy on purpose: members are made inactive instead.

revoke all on public.members from anon;
revoke all on public.staff from anon;

-- Keep updated_at current on every edit.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();
