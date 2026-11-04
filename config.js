// Supabase settings, from Supabase > Project Settings > API.
// Leave them blank to run in demo mode: made-up members, saved on this device only.
// The anon key is meant to be public. The rules in supabase/schema.sql keep member data private.
// Never put the service_role key (or any other secret) in this file.
window.CONFIG = {
  supabaseUrl: 'https://uyafarruajkltsyofrwq.supabase.co',
  // Payment reminder emails (reminders/SETUP.md). Turn this on once the Gmail script is set
  // up, so the app shows reminder details. While it's off the app says nothing about reminders.
  remindersOn: false,
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWZhcnJ1YWprbHRzeW9mcndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NDAyMDUsImV4cCI6MjEwOTIxNjIwNX0.G3ndpqG93lFBlCWgHimpa6w_rbFJ3wrSiddNjwes4sM'
};
