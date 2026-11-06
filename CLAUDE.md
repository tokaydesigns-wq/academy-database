# Academy Database: notes for Claude

A web app for the gym the owner works at. A few staff use it on a phone, tablet or computer to keep
track of members, waivers, class enrolment and payments. The gym owner has approved it.

The owner of this project isn't a developer. Write to them in plain language, show what changed
(screenshots help), and say clearly what you did and didn't test.

## Decisions so far (2026-11-02)

- **Free only.** Free hosting (GitHub Pages or similar) and the Supabase free tier for the shared
  database and staff logins.
- **No member data in the code.** Members, waivers and payments live in Supabase behind a staff
  login, with row-level security on every table. The Supabase "anon" key is fine to put in the code
  only because of that. Never put the service-role key or any other secret in a file.
- **Payments are records only.** Amount, date, method (cash/card/etc.), what it was for, and who's
  paid or behind. **Never store card numbers or bank details.** If card charging comes later, it
  goes through a provider like Stripe so card details never touch our database.
- **Waivers, both ways:** members sign on screen (finger signature, saved with date and waiver
  version), and staff can upload photos of old paper waivers.
  - The wording is copied **exactly** (typos included) from the gym's "Academy Enrollment.pdf"
    into `js/waiver-text.js`. Never edit legal text without the owner's say-so. If the wording
    changes, bump `WAIVER.version`, and members who signed an older version get asked to re-sign.
  - Each signed waiver stores a copy of the exact text that was signed.
  - Signing happens with a staff member signed in. **Front desk mode** (`js/kiosk.js`) lets
    members fill in their own details and sign on the gym's Android tablet: it's signed in by staff, only
    the front desk screens can be shown, leaving needs the staff password, and members never see
    anyone else's data. Existing members are matched by name + birthday (or phone) and only
    blank fields are filled. Sign-ups get a `review_note` ("To check") for staff to confirm.
  - The parent section and parent signature on the tablet only appear once the date of birth
    shows they're under 18 (`syncKioskAge()` → `syncMinor()`); adults never see them.
  - **Family sign-up** (`js/kiosk-family.js`): one parent adds each child under 18 and signs the
    waiver once; each child gets their own member record and waiver signed by the parent. The
    parent is only a member if they tick "I'm training too". Family plan: the payer is the parent
    if training, otherwise child 1; everyone else is "covered". Existing members keep their plan.
  - The tablet form is in English or Spanish (buttons on the welcome screen). All its wording is
    in `js/kiosk-text.js`. The Spanish waiver there is a **reference translation** shown above the
    official English waiver, which is what's signed; the saved waiver keeps both.
  - Under 18: a parent or guardian signs, and their name is recorded with the signature.
  - A waiver lasts as long as the person is a member. Only ask for a new one if the wording changes.
- No build step and no frameworks unless there's a clear reason. Plain HTML, CSS and JavaScript.
- Use made-up test members while building. No real member data in test files or screenshots.

## Prices (from the gym's price list, 2026-11-02)

No contracts and no auto-payments. Staff pick a member's plan (Kickboxing only, Muay Thai, Jiu
Jitsu, All 3, family, covered, custom) or let the app work it out from the programs of the
classes they're in (`planFor()` in payments.js). If their classes include a program their plan
doesn't cover, the member page shows a warning.

- Kickboxing only: $39.99/month, unlimited.
- Muay Thai or Jiu Jitsu: $59.99/month, and Kickboxing is included free.
- +$10 for each extra course, e.g. Muay Thai + Jiu Jitsu = $69.99 (Kickboxing still included).
- Family plan: $150/month and covers the whole household. One member pays, and the others are
  "covered" by them.
- Nothing is due for months before a member was added to the app (`joinedMonth()`, from
  `created_at`) or while their plan is paused (`pauses` table, `pauseFor()`). Pauses are kept
  after they end so past paused months never count as owed. Past months use the current plan.
- **Payment reminders:** a Google Apps Script in the gym's Gmail (`reminders/Reminders.gs`,
  set up with `reminders/SETUP.md`) emails everyone who owes on the 15th. It uses the SQL
  function `members_owing()`, which repeats the billing rules from `planFor()`/`statusFor()`.
  **If the billing rules or prices change, change both**, and re-check them against each other.
  `remindersOn` in `config.js` switches the app's reminder notes on once the script is set up
  (off as of 2026-11-04: the owner will set it up later).
- Staff can set a custom price for special deals. Karate and Judo are no longer offered. Punch
  cards exist, but the owner chose not to track them.

## Build order

1. Staff login, and members (contact info, emergency contact)
2. Waivers (sign in the app, or upload a paper one)
3. Classes and enrolment
4. Payments log, and who's overdue

## How the app is put together

`index.html` loads supabase-js from jsDelivr, then `config.js`, `js/core.js` (helpers, `esc()`),
`js/data.js` (`DB`: demo storage or Supabase, same methods), `js/ui.js` (hash router, member
screens, event handlers), `js/classes.js` (class screens), `js/payments.js` (prices, Payments
tab, record payment) and `js/backup.js` (CSV downloads on the account screen; Supabase's free
plan has no restorable backups, so these are the gym's safety copy). Routes: `#/members`, `#/m/ID`, `#/new`, `#/edit/ID`, `#/join/ID`,
`#/account`, `#/classes`, `#/c/ID`, `#/new-class`, `#/edit-class/ID`, `#/enroll/ID`,
`#/payments`, `#/pay/MEMBER_ID`, `#/report` (`js/report.js`: money in by paid date, by method and plan, six-month trend), `#/merge/ID` (`js/merge.js`: merging a duplicate, done in one step by
the `merge_members()` database function), `#/followups` (`js/followups.js`: who owes, has no waiver or is
"To check", with Call buttons). New screens register in `SCREENS`, forms in `FORMS`, and
`data-act` clicks in `ACTIONS`.

- **Demo mode** turns on when `config.js` is blank, or with `?demo` in the address. It uses
  made-up data in localStorage, so test there instead of on the real database.
- **Database changes go live separately.** After changing `schema.sql`, the owner must run it in
  Supabase **before** the pull request is merged, or the live app can't load.
- **Always `esc()` member data** before putting it in HTML.
- **Class times:** use `sessionsOf(c)` (core.js), which gives one `{day, start, end}` per day so
  a class can run at different times on different days. `days`/`start_time`/`end_time` are kept
  in step with the first session for older code and backups.
- Database changes go in `supabase/schema.sql`. Keep it safe to re-run, and give every table RLS
  using `public.is_staff()`. `SETUP.md` is the owner's guide for setting up Supabase.
- Test locally: `python -m http.server 8130`, then open http://localhost:8130.

## Installing on the tablet

`manifest.webmanifest`, `icons/` and `sw.js` let the app be added to a home screen and open
full-screen. `sw.js` is network-only on purpose: it caches nothing, so updates still arrive
through the `?v=` numbers and no member data is stored on the device.

## Releasing

- **Bump `?v=` on every file link in `index.html`** in each pull request that changes CSS or JS
  (all to the same new number). GitHub Pages lets phones keep files for 10 minutes, and without
  this a phone can mix old and new files and break.
- If `supabase/schema.sql` changed, the new block must be run in Supabase **before** merging.

## Working rules

- Work on a branch and open a pull request for the owner to review once there's a remote.
- One topic per PR, with a short title in plain words. The description says what changed, why,
  how it was tested, and anything left undone.
- Test at phone width (375px) and tablet width, light and dark mode, with no sideways scrolling.
