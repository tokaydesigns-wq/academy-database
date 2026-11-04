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
-- Classes that stop running are made inactive. Empty classes can be deleted (see the end of this file).

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

-- Deleting a class (added 2026-11-02): staff can delete a class only when nobody is signed
-- up for it. The app takes former members' sign-ups out first. Classes with people in them
-- should be marked "not running" instead.
drop policy if exists "staff delete empty classes" on public.classes;
create policy "staff delete empty classes" on public.classes
  for delete to authenticated using (
    public.is_staff()
    and not exists (select 1 from public.enrollments e where e.class_id = classes.id)
  );

-- Different times on different days (added 2026-11-02). Each session is
-- {"day": "mon", "start": "18:00", "end": "19:00"}. days/start_time/end_time are still
-- filled in (from the first session) so older code and backups keep working. Classes saved
-- before this have an empty list, and the app reads their days and times instead.
alter table public.classes add column if not exists sessions jsonb not null default '[]'::jsonb;

-- Paused plans (added 2026-11-02): a member who takes a month or two off. Nothing is due for
-- months from start_month to end_month (both included). end_month is empty while there's no
-- return date yet. Pauses are kept after they end, so past paused months never count as owed.
create table if not exists public.pauses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  start_month text not null check (start_month ~ '^\d{4}-\d{2}$'),
  end_month text check (end_month is null or (end_month ~ '^\d{4}-\d{2}$' and end_month >= start_month)),
  note text not null default '',
  created_by text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now()
);

alter table public.pauses enable row level security;
drop policy if exists "staff read pauses" on public.pauses;
drop policy if exists "staff add pauses" on public.pauses;
drop policy if exists "staff edit pauses" on public.pauses;
drop policy if exists "staff remove pauses" on public.pauses;
create policy "staff read pauses" on public.pauses
  for select to authenticated using (public.is_staff());
create policy "staff add pauses" on public.pauses
  for insert to authenticated with check (public.is_staff());
create policy "staff edit pauses" on public.pauses
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff remove pauses" on public.pauses
  for delete to authenticated using (public.is_staff());
revoke all on public.pauses from anon;

-- When a member leaves (added 2026-11-03): the first month they're no longer billed, e.g.
-- '2026-12'. The app sets it when "Active member" is unticked and clears it if they come
-- back. Anything owed before they left still counts.
alter table public.members add column if not exists inactive_since text
  check (inactive_since is null or inactive_since ~ '^\d{4}-\d{2}$');

-- Front desk mode (added 2026-11-04): members fill in their own details and sign the waiver
-- on the gym's iPad. review_note tells staff what to check (e.g. the program they asked for);
-- staff clear it once they've confirmed the plan.
alter table public.members add column if not exists review_note text not null default '';

-- Payment reminders (added 2026-11-04). A Google Apps Script in the gym's Gmail
-- (reminders/Reminders.gs) runs on the 15th, asks members_owing() who hasn't paid for the
-- month, emails them, and logs each email in reminders so nobody is emailed twice.

-- Who still owes for a month, using the same rules as the app (planFor/statusFor in
-- js/payments.js): nothing before they joined, after they left, or while paused; prices from
-- their plan, or from their classes' programs when the plan is "auto". Keep both in step.
-- "security invoker" means the normal staff-only rules apply to whoever calls it.
create or replace function public.members_owing(p_month text)
returns table (member_id uuid, first_name text, last_name text, email text,
               due numeric, paid numeric, owes numeric)
language sql stable security invoker set search_path = public as $$
  with m as (
    select mem.*,
      to_char(mem.created_at at time zone 'America/Chicago', 'YYYY-MM') as joined,
      case when mem.active then null
           else coalesce(mem.inactive_since, to_char(date_trunc('month',
             coalesce(mem.updated_at, mem.created_at) at time zone 'America/Chicago') + interval '1 month', 'YYYY-MM'))
      end as left_month
    from members mem
  ),
  progs as (
    select e.member_id,
      count(distinct c.program) filter (where c.program in ('muay_thai', 'jiu_jitsu')) as premium,
      bool_or(c.program = 'kickboxing') as kick
    from enrollments e join classes c on c.id = e.class_id and c.active
    group by e.member_id
  ),
  priced as (
    select m.*, case m.plan
        when 'covered' then 0
        when 'family' then 150.00
        when 'custom' then coalesce(m.custom_price, 0)
        when 'kickboxing' then 39.99
        when 'muay_thai' then 59.99
        when 'jiu_jitsu' then 59.99
        when 'all' then 69.99
        else case when coalesce(p.premium, 0) > 0 then 59.99 + 10.00 * (p.premium - 1)
                  when coalesce(p.kick, false) then 39.99 else 0 end
      end as price
    from m left join progs p on p.member_id = m.id
  ),
  status as (
    select pr.*,
      case when p_month < pr.joined
             or (pr.left_month is not null and p_month >= pr.left_month)
             or exists (select 1 from pauses pa where pa.member_id = pr.id and pa.start_month <= p_month
                        and (pa.end_month is null or p_month <= pa.end_month))
           then 0 else pr.price end as due_amt,
      coalesce((select sum(py.amount) from payments py
                where py.member_id = pr.id and py.covers_month = p_month), 0) as paid_amt
    from priced pr
  )
  select id, first_name, last_name, email, due_amt, paid_amt, due_amt - paid_amt
  from status
  where due_amt - paid_amt > 0
  order by first_name, last_name;
$$;
revoke execute on function public.members_owing(text) from public, anon;
grant execute on function public.members_owing(text) to authenticated;

-- One row per reminder email sent.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  email text not null,
  amount numeric(8,2) not null,
  sent_at timestamptz not null default now(),
  unique (member_id, month)
);

alter table public.reminders enable row level security;
drop policy if exists "staff read reminders" on public.reminders;
drop policy if exists "staff add reminders" on public.reminders;
create policy "staff read reminders" on public.reminders
  for select to authenticated using (public.is_staff());
create policy "staff add reminders" on public.reminders
  for insert to authenticated with check (public.is_staff());
revoke all on public.reminders from anon;
