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

-- Classes: the weekly timetable.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  days text[] not null default '{}',   -- e.g. {mon,wed}
  start_time time,
  end_time time,
  instructor text not null default '',
  capacity int check (capacity is null or capacity > 0),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes enable row level security;
drop policy if exists "staff read classes" on public.classes;
drop policy if exists "staff add classes" on public.classes;
drop policy if exists "staff edit classes" on public.classes;
create policy "staff read classes" on public.classes
  for select to authenticated using (public.is_staff());
create policy "staff add classes" on public.classes
  for insert to authenticated with check (public.is_staff());
create policy "staff edit classes" on public.classes
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- No delete policy on purpose: classes that stop running are made inactive.

drop trigger if exists classes_touch on public.classes;
create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

-- Enrolments: which members are signed up for which classes.
-- Taking someone out of a class deletes their row here; the member and class stay.
create table if not exists public.enrollments (
  member_id uuid not null references public.members(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  enrolled_on date not null default current_date,
  primary key (member_id, class_id)
);

alter table public.enrollments enable row level security;
drop policy if exists "staff read enrollments" on public.enrollments;
drop policy if exists "staff add enrollments" on public.enrollments;
drop policy if exists "staff remove enrollments" on public.enrollments;
create policy "staff read enrollments" on public.enrollments
  for select to authenticated using (public.is_staff());
create policy "staff add enrollments" on public.enrollments
  for insert to authenticated with check (public.is_staff());
create policy "staff remove enrollments" on public.enrollments
  for delete to authenticated using (public.is_staff());

revoke all on public.classes from anon;
revoke all on public.enrollments from anon;

-- Programs and plans: what each member pays per month.
-- A class's program sets the price (kickboxing, muay_thai, jiu_jitsu; empty = no charge, e.g. open mat).
alter table public.classes add column if not exists program text
  check (program in ('kickboxing', 'muay_thai', 'jiu_jitsu'));

-- plan: auto = worked out from their classes, family = pays the family plan,
-- covered = on someone else's family plan (paid_by), custom = custom_price.
alter table public.members add column if not exists plan text not null default 'auto'
  check (plan in ('auto', 'family', 'covered', 'custom'));
alter table public.members add column if not exists custom_price numeric(8,2)
  check (custom_price is null or custom_price >= 0);
alter table public.members add column if not exists paid_by uuid
  references public.members(id) on delete set null;

-- Payments: a record of money received. Never card numbers or bank details.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(8,2) not null check (amount > 0),
  paid_on date not null default current_date,
  covers_month text not null check (covers_month ~ '^\d{4}-\d{2}$'),   -- e.g. 2026-11
  method text not null check (method in ('cash', 'card', 'check', 'other')),
  note text not null default '',
  recorded_by text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
drop policy if exists "staff read payments" on public.payments;
drop policy if exists "staff add payments" on public.payments;
drop policy if exists "staff remove payments" on public.payments;
create policy "staff read payments" on public.payments
  for select to authenticated using (public.is_staff());
create policy "staff add payments" on public.payments
  for insert to authenticated with check (public.is_staff());
-- Staff can remove a payment entered by mistake.
create policy "staff remove payments" on public.payments
  for delete to authenticated using (public.is_staff());

revoke all on public.payments from anon;

-- Plans staff can pick directly (added 2026-11-02): kickboxing only, muay_thai, jiu_jitsu,
-- or all (Muay Thai + Jiu Jitsu, Kickboxing included in every one).
alter table public.members drop constraint if exists members_plan_check;
alter table public.members add constraint members_plan_check
  check (plan in ('auto', 'kickboxing', 'muay_thai', 'jiu_jitsu', 'all', 'family', 'covered', 'custom'));

-- Enrollment form fields (from "Academy Enrollment.pdf"), added 2026-11-02.
alter table public.members add column if not exists sex text check (sex in ('male', 'female'));
alter table public.members add column if not exists city text not null default '';
alter table public.members add column if not exists state text not null default '';
alter table public.members add column if not exists zip text not null default '';
alter table public.members add column if not exists alt_phone text not null default '';
alter table public.members add column if not exists emergency_alt_phone text not null default '';
alter table public.members add column if not exists medical text not null default '';

-- Waivers: one row each time someone signs on screen or a paper waiver is photographed.
-- They're legal records, so staff can add them but not change or delete them.
create table if not exists public.waivers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('signed', 'paper')),
  version text not null,                    -- WAIVER.version in js/waiver-text.js
  waiver_text text not null default '',     -- the exact wording that was signed
  signed_name text not null default '',
  signature text,                           -- participant's signature, as a PNG image
  guardian_name text not null default '',
  guardian_signature text,                  -- parent/guardian's signature (under 18)
  photo_path text,                          -- paper waiver photo in the "waivers" storage bucket
  signed_on date not null default current_date,
  recorded_by text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now()
);

alter table public.waivers enable row level security;
drop policy if exists "staff read waivers" on public.waivers;
drop policy if exists "staff add waivers" on public.waivers;
create policy "staff read waivers" on public.waivers
  for select to authenticated using (public.is_staff());
create policy "staff add waivers" on public.waivers
  for insert to authenticated with check (public.is_staff());
revoke all on public.waivers from anon;

-- Private storage for photos of paper waivers. Only staff can see or add them.
insert into storage.buckets (id, name, public)
  values ('waivers', 'waivers', false)
  on conflict (id) do nothing;
drop policy if exists "staff read waiver photos" on storage.objects;
drop policy if exists "staff add waiver photos" on storage.objects;
create policy "staff read waiver photos" on storage.objects
  for select to authenticated using (bucket_id = 'waivers' and public.is_staff());
create policy "staff add waiver photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'waivers' and public.is_staff());
