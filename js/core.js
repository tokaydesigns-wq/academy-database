// Small helpers shared by every screen.

// Demo mode runs without Supabase, using made-up members saved in this browser only.
const DEMO = !CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey;

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
