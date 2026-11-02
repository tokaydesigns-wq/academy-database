// Small helpers shared by every screen.

// Demo mode runs without Supabase, using made-up data saved in this browser only.
// Adding ?demo to the address forces it, for testing changes without touching real data.
const DEMO = !CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey ||
  new URLSearchParams(location.search).has('demo');

const $ = (sel, root = document) => root.querySelector(sel);

// Escape text before putting it into HTML, so member data can never run as code.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fullName(m) {
  return [m.first_name, m.last_name].filter(Boolean).join(' ');
}

function initials(m) {
  return ((m.first_name || '')[0] || '') + ((m.last_name || '')[0] || '');
}

// "2014-03-09" -> "9 Mar 2014", in the phone's own date style.
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ageFrom(iso) {
  if (!iso) return null;
  const dob = new Date(iso.slice(0, 10) + 'T00:00');
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday = now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  return beforeBirthday ? age - 1 : age;
}

// Digits and a leading + only, for tel: links.
function telHref(phone) {
  return 'tel:' + String(phone).replace(/[^\d+]/g, '');
}

// Loose check: something@something.something
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Days of the week, Monday first, as stored in classes.days.
const DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
  ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']
];

// ['mon','wed'] -> "Mon, Wed"
function fmtDays(days) {
  if (!days || !days.length) return '';
  if (days.length === 7) return 'Every day';
  return DAYS.filter(([key]) => days.includes(key)).map(([, label]) => label).join(', ');
}

// "18:00" or "18:00:00" -> "6:00 PM" (in the phone's own time style)
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// A class's sessions, Monday first: [{ day: 'mon', start: '18:00', end: '19:00' }, ...].
// Classes saved before per-day times existed only have days + one start/end, so build the
// sessions from those.
function sessionsOf(c) {
  const list = c.sessions && c.sessions.length ? c.sessions
    : (c.days || []).map(day => ({ day, start: c.start_time || '', end: c.end_time || '' }));
  const order = key => DAYS.findIndex(([k]) => k === key);
  return list
    .map(s => ({ day: s.day, start: (s.start || '').slice(0, 5), end: (s.end || '').slice(0, 5) }))
    .sort((a, b) => order(a.day) - order(b.day));
}

function fmtTimeRange(start, end) {
  return start && end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start);
}

// "Mon, Wed · 6:00 PM–7:00 PM", or with different times on different days:
// "Mon, Wed · 6:00 PM–7:00 PM; Sat · 10:00 AM–11:00 AM"
function fmtSchedule(c) {
  const groups = [];
  for (const s of sessionsOf(c)) {
    const time = fmtTimeRange(s.start, s.end);
    const same = groups.find(g => g.time === time);
    if (same) same.days.push(s.day); else groups.push({ time, days: [s.day] });
  }
  return groups.map(g => [fmtDays(g.days), g.time].filter(Boolean).join(' · ')).join('; ') || 'No set time';
}

// ---------- Money and months ----------

// Prices in cents, from the gym's price list (see CLAUDE.md).
const PRICES = { kickboxing: 3999, premium: 5999, extraCourse: 1000, family: 15000 };

// Programs a class can belong to. Muay Thai and Jiu Jitsu are "premium" and include Kickboxing.
const PROGRAMS = [['kickboxing', 'Kickboxing'], ['muay_thai', 'Muay Thai'], ['jiu_jitsu', 'Jiu Jitsu']];
const PREMIUM = ['muay_thai', 'jiu_jitsu'];

function programLabel(key) {
  const p = PROGRAMS.find(([k]) => k === key);
  return p ? p[1] : '';
}

const PAY_METHODS = [['cash', 'Cash'], ['card', 'Card'], ['check', 'Check'], ['other', 'Other']];

function methodLabel(key) {
  const p = PAY_METHODS.find(([k]) => k === key);
  return p ? p[1] : key;
}

// Money is kept in whole cents in the app to avoid rounding errors.
function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function fmtMoney(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Today as "2026-11-02", in local time (not UTC).
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Months are "2026-11" strings.
function thisMonth() {
  return todayISO().slice(0, 7);
}

function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-11" -> "November 2026"
function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
