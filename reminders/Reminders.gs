/**
 * Academy Martial Arts: monthly payment reminders.
 *
 * This runs in the gym's Gmail account as a Google Apps Script (setup: reminders/SETUP.md).
 * On the 15th of each month at about 9am Chicago time, it asks the database who still owes
 * for the month (members_owing in supabase/schema.sql, the same rules as the app), emails
 * each of them from the gym's Gmail, logs it so nobody is emailed twice, and emails the gym
 * a summary.
 *
 * The reminder login's email and password live in Script Properties (Project Settings), never
 * in this file. The key below is the public one from config.js; it's safe to share.
 */

const SUPABASE_URL = 'https://uyafarruajkltsyofrwq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWZhcnJ1YWprbHRzeW9mcndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NDAyMDUsImV4cCI6MjEwOTIxNjIwNX0.G3ndpqG93lFBlCWgHimpa6w_rbFJ3wrSiddNjwes4sM';
const GYM_NAME = 'Academy Martial Arts';
const TIME_ZONE = 'America/Chicago';
const DAILY_LIMIT = 90;   // Gmail allows about 100 emails a day; keep some room

// The email members get. {first}, {month} and {amount} are filled in for each person.
const SUBJECT = '{month} membership payment reminder';
const MESSAGE = [
  'Hi {first},',
  '',
  'Just a friendly reminder that we haven’t received your {month} membership payment of ${amount} yet.',
  '',
  'You can pay at the front desk next time you’re in. If you’ve already paid, or think this is a mistake, just reply to this email and we’ll sort it out.',
  '',
  'Thanks,',
  GYM_NAME
].join('\n');

/** Runs on the 15th. Emails everyone who owes, then emails the gym a summary. */
function sendPaymentReminders() {
  run_(false);
}

/** Try it safely: emails ONLY the gym a list of who would be reminded. Nobody else is emailed. */
function previewReminders() {
  run_(true);
}

/** Run once to schedule sendPaymentReminders for the 15th of every month, around 9am. */
function setUpMonthlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendPaymentReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPaymentReminders')
    .timeBased().onMonthDay(15).atHour(9).inTimezone(TIME_ZONE).create();
  Logger.log('Scheduled: the 15th of every month, around 9am (' + TIME_ZONE + ').');
}

function run_(previewOnly) {
  const now = new Date();
  const month = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM');
  const monthName = Utilities.formatDate(now, TIME_ZONE, 'MMMM');
  const token = signIn_();

  const owing = api_(token, 'post', '/rest/v1/rpc/members_owing', { p_month: month });
  const alreadySent = new Set(
    api_(token, 'get', '/rest/v1/reminders?select=member_id&month=eq.' + month).map(r => r.member_id));

  const sent = [];
  const skipped = [];
  owing.forEach(m => {
    const name = (m.first_name + ' ' + (m.last_name || '')).trim();
    const amount = Number(m.owes).toFixed(2);
    if (alreadySent.has(m.member_id)) {
      skipped.push(name + ': already reminded this month');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email || '')) {
      skipped.push(name + ': owes $' + amount + ' but has no email on file');
    } else if (sent.length >= DAILY_LIMIT) {
      skipped.push(name + ': not sent yet (Gmail daily limit). Run sendPaymentReminders again tomorrow.');
    } else {
      if (!previewOnly) {
        const fill = s => s.replace(/{first}/g, m.first_name).replace(/{month}/g, monthName).replace(/{amount}/g, amount);
        GmailApp.sendEmail(m.email, fill(SUBJECT), fill(MESSAGE), { name: GYM_NAME });
        // Logged after sending, so a failed email is tried again next time.
        api_(token, 'post', '/rest/v1/reminders',
          { member_id: m.member_id, month: month, email: m.email, amount: m.owes });
      }
      sent.push(name + ' <' + m.email + '>: $' + amount);
    }
  });

  const title = previewOnly
    ? 'PREVIEW (nothing was sent): ' + monthName + ' payment reminders'
    : monthName + ' payment reminders sent';
  const summary = [
    previewOnly ? 'This is a preview. No members were emailed.' : 'Reminders went out today.',
    '',
    (previewOnly ? 'Would email' : 'Emailed') + ' (' + sent.length + '):',
    sent.length ? sent.join('\n') : '(nobody)',
    '',
    'Not emailed (' + skipped.length + '):',
    skipped.length ? skipped.join('\n') : '(nobody)'
  ].join('\n');
  GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), title, summary, { name: 'Academy Database' });
  Logger.log(summary);
}

// Sign in to the database with the reminder login stored in Script Properties.
function signIn_() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('REMINDER_EMAIL');
  const password = props.getProperty('REMINDER_PASSWORD');
  if (!email || !password) {
    throw new Error('Add REMINDER_EMAIL and REMINDER_PASSWORD in Project Settings → Script Properties.');
  }
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY },
    payload: JSON.stringify({ email: email, password: password })
  });
  if (res.getResponseCode() !== 200) throw new Error('Couldn’t sign in to the database: check the reminder login.');
  return JSON.parse(res.getContentText()).access_token;
}

// Call the database as the reminder login. Throws with the database's message on failure.
function api_(token, method, path, body) {
  const res = UrlFetchApp.fetch(SUPABASE_URL + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, Prefer: 'return=minimal' },
    payload: body ? JSON.stringify(body) : undefined
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error('Database error ' + code + ': ' + res.getContentText());
  const text = res.getContentText();
  return text ? JSON.parse(text) : null;
}
