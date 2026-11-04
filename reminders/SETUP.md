# Setting up automatic payment reminders

On the **15th of every month, around 9am**, the gym's Gmail emails every member who still owes for
that month, and sends the gym a summary of who was emailed. It's free. It runs in Google's
"Apps Script", which comes with every Gmail account.

Who gets an email: anyone who owes for the current month, using the same rules as the app.
Nobody who is paused, covered by someone's family plan, has left, or joined after that month.
Nobody gets two reminders for the same month. Members with no email on file are listed in the
summary so staff can call them instead.

Takes about 15 minutes, once.

## 1. Make a login for the reminders (in Supabase)

The script needs its own login to read who owes. Use a separate one rather than a staff member's,
so you can change it without affecting anyone.

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Email: `academykickbox+reminders@gmail.com`. The `+reminders` part still goes to the gym's
   inbox, but it counts as a separate login.
3. Choose a long password and keep it somewhere safe. Tick **Auto Confirm User**.
4. Add that email to the **staff** table, all lowercase, with the name "Payment reminders".
   (Claude can do this step for you.)

## 2. Add the script (in the gym's Google account)

1. Signed in as **academykickbox@gmail.com**, go to https://script.google.com and click
   **New project**.
2. Rename it (top left) to **Academy payment reminders**.
3. Delete what's in the editor, then paste in everything from `reminders/Reminders.gs`.
   Click **Save** (the disk icon).
4. Click the **gear (Project Settings)**, scroll to **Script Properties**, then
   **Add script property** twice:
   - `REMINDER_EMAIL` = `academykickbox+reminders@gmail.com`
   - `REMINDER_PASSWORD` = the password from step 1
   Click **Save script properties**.

## 3. Try it safely

1. Back in the editor, choose **previewReminders** in the function menu at the top, then **Run**.
2. Google asks for permission the first time:
   - **Review permissions**, then pick the gym's account.
   - "Google hasn't verified this app": that's expected for your own script. Click
     **Advanced**, then **Go to Academy payment reminders (unsafe)**, then **Allow**.
3. Check the gym's inbox for **"PREVIEW (nothing was sent)"**. It lists who *would* be emailed.
   **No members are emailed by the preview.**

## 4. Turn it on

1. Choose **setUpMonthlyTrigger** in the function menu, then **Run**. This schedules it for the
   15th of every month.
2. To check: the **clock icon (Triggers)** on the left shows one trigger for
   `sendPaymentReminders`.

That's it. Each month on the 15th, the gym gets a "payment reminders sent" email listing who was
reminded. Member pages in the app show "Reminder emailed".

## Changing or stopping it

- **Change the wording:** edit `SUBJECT` and `MESSAGE` near the top of the script, then Save.
- **Pause it:** Triggers (clock icon), then delete the `sendPaymentReminders` trigger. Run
  `setUpMonthlyTrigger` again to turn it back on.
- **Send them now** (e.g. if the 15th was missed): run `sendPaymentReminders` by hand. It never
  emails anyone twice in the same month.
- Gmail allows about 100 emails a day. If more than 90 people owe, the summary says so. Just run
  `sendPaymentReminders` again the next day.
