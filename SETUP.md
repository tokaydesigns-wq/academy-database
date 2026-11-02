# Connecting the real database

Until this is done, the app runs in **demo mode** with made-up members, saved only in the browser
you're using. These steps connect it to a free Supabase database so staff share the same data.
It takes about 15 minutes. You only do it once.

## 1. Make the Supabase project

1. Go to https://supabase.com and sign up (free plan).
2. Click **New project**. Pick any name (e.g. "academy"), make a strong database password and keep
   it somewhere safe, and choose the region closest to the gym.
3. Wait a minute or two while it sets up.

## 2. Create the tables and privacy rules

1. In the left menu open **SQL Editor**, then **New query**.
2. Open the file `supabase/schema.sql` from this folder, copy all of it, paste it in, and press **Run**.
   It should say "Success. No rows returned".

## 3. Turn off public sign-ups

So nobody can make their own account:

1. Open **Authentication**, then **Sign In / Providers** (on some versions it's under **Settings**).
2. Turn **off** "Allow new users to sign up".

## 4. Add each staff member

For each person (including you):

1. **Authentication → Users → Add user → Create new user.** Enter their email and a starting
   password, and tick **Auto Confirm User**.
2. **Table Editor → staff → Insert row.** Type the same email **in lowercase** and their name.

Both steps are needed. The login lets them in, and the staff list lets them see member data.
Staff can change their password from the ☰ menu after they sign in.
To remove someone, delete their row in the staff table and their user.

## 5. Connect the app

1. Open **Project Settings → API** (or **Data API**).
2. Copy the **Project URL** and the **anon public** key.
3. Send them to Claude, or paste them into `config.js`.

**Don't** copy the `service_role` key anywhere. It gets past every privacy rule.
