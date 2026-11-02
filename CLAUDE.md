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
- No build step and no frameworks unless there's a clear reason. Plain HTML, CSS and JavaScript.
- Use made-up test members while building. No real member data in test files or screenshots.

## Build order

1. Staff login, and members (contact info, emergency contact)
2. Waivers (sign in the app, or upload a paper one)
3. Classes and enrolment
4. Payments log, and who's overdue

## Working rules

- Work on a branch and open a pull request for the owner to review once there's a remote.
- One topic per PR, with a short title in plain words. The description says what changed, why,
  how it was tested, and anything left undone.
- Test at phone width (375px) and tablet width, light and dark mode, with no sideways scrolling.
