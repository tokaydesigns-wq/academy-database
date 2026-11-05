// Backups: download members, classes, sign-ups and payments as CSV files that open in
// Excel or Google Sheets. Supabase's free plan has no restorable backups, so these are the
// gym's safety copy. Shown on the account screen (#/account).

const BACKUP_KEY = 'academy.lastBackup';

// One CSV cell. Quotes when needed, and stops spreadsheet apps from treating text that
// starts with = + - @ as a formula (a known trick for sneaking commands into spreadsheets).
// Plain numbers like "+1 555 0199" are left alone.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s))) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

const yesNo = b => (b ? 'Yes' : 'No');
const money = cents => (cents / 100).toFixed(2);
const memberName = id => {
  const m = findMember(id);
  return m ? fullName(m) : '(removed member)';
};

// Each backup file: a label, a short description, and a function that builds its CSV text.
const BACKUPS = {
  members: {
    label: 'Members',
    about: 'Contact details, emergency contacts, plans and classes',
    build: () => toCsv(
      ['First name', 'Last name', 'Active', 'Phone', 'Alt phone', 'Email', 'Date of birth', 'Sex',
        'Street address', 'City', 'State', 'Zip', 'Medical conditions',
        'Emergency contact', 'Relation', 'Emergency phone', 'Emergency alt phone',
        'Parent/guardian', 'Parent relation', 'Parent phone', 'Parent email',
        'Waiver', 'Plan', 'Monthly price', 'Paused now', 'Unpaid total', 'Classes', 'Notes', 'Added'],
      [...state.members].sort((a, b) => fullName(a).localeCompare(fullName(b))).map(m => {
        const plan = planFor(m);
        return [m.first_name, m.last_name, yesNo(m.active), m.phone, m.alt_phone, m.email,
          m.date_of_birth, m.sex, m.address, m.city, m.state, m.zip, m.medical,
          m.emergency_name, m.emergency_relation, m.emergency_phone, m.emergency_alt_phone,
          m.guardian_name, m.guardian_relation, m.guardian_phone, m.guardian_email,
          waiverStatus(m).label, plan.label, money(plan.cents), yesNo(pauseFor(m, thisMonth())),
          money(unpaidMonths(m).reduce((sum, b) => sum + b.owes, 0)),
          classesOf(m.id).map(c => c.name).join('; '), m.notes, (m.created_at || '').slice(0, 10)];
      }))
  },
  classes: {
    label: 'Classes',
    about: 'The timetable and how many are signed up',
    build: () => toCsv(
      ['Class', 'Program', 'Days and times', 'Instructor', 'Max people', 'Signed up', 'Running', 'Notes'],
      sortClasses(state.classes).map(c => [c.name, programLabel(c.program) || 'No charge',
        fmtSchedule(c), c.instructor, c.capacity || '', rosterOf(c.id).length, yesNo(c.active), c.notes]))
  },
  signups: {
    label: 'Class sign-ups',
    about: 'Who is in which class',
    build: () => toCsv(
      ['Class', 'Member', 'Signed up on'],
      state.enrollments
        .map(e => [findClass(e.class_id)?.name || '(removed class)', memberName(e.member_id), e.enrolled_on])
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])))
  },
  payments: {
    label: 'Payments',
    about: 'Every payment recorded, newest first',
    build: () => toCsv(
      ['Date paid', 'Member', 'Amount', 'Method', 'For month', 'Note', 'Recorded by'],
      [...state.payments]
        .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
        .map(p => [p.paid_on, memberName(p.member_id), money(toCents(p.amount)),
          methodLabel(p.method), p.covers_month, p.note, p.recorded_by]))
  }
};

// Save text as a file on this device. The BOM at the start makes Excel read accents correctly.
function saveFile(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupFileName(kind) {
  return `academy-${kind}-${todayISO()}.csv`;
}

function lastBackup() {
  try { return localStorage.getItem(BACKUP_KEY); } catch (e) { return null; }
}

function noteBackup() {
  try { localStorage.setItem(BACKUP_KEY, todayISO()); } catch (e) { /* not remembered */ }
}

function backupCard() {
  const last = lastBackup();
  const days = last ? Math.round((new Date(todayISO()) - new Date(last)) / 86400000) : null;
  return `<h3 class="section">Backup</h3>
  <div class="card stack">
    <p class="small">Download the gym’s records as spreadsheets that open in Excel or Google Sheets.
      Keep a copy somewhere safe, like a USB stick or the owner’s computer, about once a month.</p>
    <p class="small ${days === null || days > 31 ? 'owes' : 'muted'}">${last
      ? `Last downloaded on this device: ${esc(fmtDate(last))}${days > 31 ? ' (over a month ago)' : ''}`
      : 'Not downloaded on this device yet.'}</p>
    <button class="btn primary" data-act="backup-all">Download all 4 files</button>
    <ul class="plain backup-list">${Object.entries(BACKUPS).map(([kind, b]) => `
      <li class="pay-row">
        <span class="grow"><strong>${b.label}</strong><span class="muted small">${b.about}</span></span>
        <button class="btn small-btn" data-act="backup" data-kind="${kind}">Download</button>
      </li>`).join('')}</ul>
    <p class="muted small">These files contain members’ personal details. Don’t email them around
      or leave them on a shared computer.</p>
  </div>`;
}

function onBackup(el) {
  const kind = el.dataset.kind;
  saveFile(backupFileName(kind), BACKUPS[kind].build());
  noteBackup();
  toast(`${BACKUPS[kind].label} downloaded`);
  render();
}

// Browsers may ask once whether to allow several downloads; a short gap between files helps.
async function onBackupAll(el) {
  el.disabled = true;
  for (const kind of Object.keys(BACKUPS)) {
    saveFile(backupFileName(kind), BACKUPS[kind].build());
    await new Promise(r => setTimeout(r, 400));
  }
  noteBackup();
  toast('All 4 files downloaded');
  render();
}

Object.assign(ACTIONS, { backup: onBackup, 'backup-all': onBackupAll });
