// Routing and screens. render() rebuilds #app from the current hash:
// #/members (list), #/m/ID (one member), #/new, #/edit/ID, #/join/ID (add member to a class),
// #/account. Class screens live in classes.js and register themselves in SCREENS.

const state = {
  user: null,
  members: [],
  classes: [],
  enrollments: [],
  loaded: false,
  loginError: '',
  filter: 'active',   // active | inactive | all
  query: ''
};

function route() {
  const [, name = 'members', id = ''] = location.hash.split('/');
  return { name, id: decodeURIComponent(id) };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const app = $('#app');
  if (!state.user) {
    app.innerHTML = loginScreen();
    return;
  }
  if (!state.loaded) {
    app.innerHTML = demoBanner() + '<p class="empty">Loading…</p>';
    try {
      [state.members, state.classes, state.enrollments] =
        await Promise.all([DB.listMembers(), DB.listClasses(), DB.listEnrollments()]);
      state.loaded = true;
    } catch (e) {
      app.innerHTML = demoBanner() + `<p class="empty">${esc(e.message)}</p>
        <p class="center"><button class="btn" data-act="retry">Try again</button></p>`;
      return;
    }
  }
  const r = route();
  const screen = SCREENS[r.name] || SCREENS.members;
  app.innerHTML = demoBanner() + screen.html(r.id) + (screen.tab ? navBar(screen.tab) : '');
  if (screen.after) screen.after(r.id);
  window.scrollTo(0, 0);
}

// Each screen: html(id) builds it, after(id) fills in live parts, tab shows the bottom bar.
const SCREENS = {
  members: { html: listScreen, after: renderList, tab: 'members' },
  m: { html: memberScreen },
  new: { html: () => formScreen(null) },
  edit: { html: formScreen },
  join: { html: joinScreen },
  account: { html: accountScreen }
};

function navBar(current) {
  const tab = (name, label) =>
    `<a class="tab ${current === name ? 'on' : ''}" href="#/${name}">${label}</a>`;
  return `<nav class="tabs">${tab('members', 'Members')}${tab('classes', 'Classes')}</nav>`;
}

function demoBanner() {
  return DEMO ? `<div class="demo">Demo mode: made-up data, saved on this device only.</div>` : '';
}

function topBar(title, back) {
  return `<header class="top">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Back">‹</a>` : '<span class="brand-dot"></span>'}
    <h1>${esc(title)}</h1>
    ${back ? '<span class="icon-btn" aria-hidden="true"></span>'
           : '<a class="icon-btn" href="#/account" aria-label="Your account">☰</a>'}
  </header>`;
}

function findMember(id) {
  return state.members.find(m => m.id === id);
}

// ---------- Sign in ----------

function loginScreen() {
  return `${demoBanner()}
  <section class="login">
    <div class="logo">AD</div>
    <h1>Academy Database</h1>
    <p class="muted">Staff sign in</p>
    <form id="login-form" class="card stack" novalidate>
      ${DEMO ? `<p class="muted small">This copy isn’t connected to a database yet,
        so any email and password will open the demo.</p>` : ''}
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      ${state.loginError ? `<p class="error">${esc(state.loginError)}</p>` : ''}
      <button class="btn primary" type="submit">Sign in</button>
      ${DEMO ? '' : '<p class="muted small center">Forgot your password? Ask the gym owner to reset it.</p>'}
    </form>
  </section>`;
}

async function onLogin(form) {
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  if (!DEMO && (!email || !password)) {
    state.loginError = 'Enter your email and password.';
    return render();
  }
  form.querySelector('button').disabled = true;
  try {
    state.user = await DB.signIn(email, password);
    state.loginError = '';
    state.loaded = false;
    go('#/members');
  } catch (e) {
    state.loginError = e.message;
    render();
  }
}

// ---------- Member list ----------

function listScreen() {
  const chip = (value, label) =>
    `<button class="chip ${state.filter === value ? 'on' : ''}" data-act="filter" data-value="${value}">${label}</button>`;
  return `${topBar('Members')}
  <div class="tools">
    <input id="search" type="search" placeholder="Search name, phone or email"
      value="${esc(state.query)}" autocomplete="off" aria-label="Search members">
    <div class="chips">${chip('active', 'Active')}${chip('inactive', 'Inactive')}${chip('all', 'All')}</div>
  </div>
  <p id="count" class="muted small"></p>
  <ul id="list" class="list"></ul>
  <a class="fab" href="#/new">+ Add member</a>`;
}

function matches(m, q) {
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const text = [fullName(m), m.email].join(' ').toLowerCase();
  return text.includes(q) || (digits.length > 2 && m.phone.replace(/\D/g, '').includes(digits));
}

// Redraws just the list, so the search box keeps focus while typing.
function renderList() {
  const q = state.query.trim().toLowerCase();
  const shown = state.members
    .filter(m => state.filter === 'all' || (state.filter === 'active') === m.active)
    .filter(m => matches(m, q))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  $('#count').textContent = shown.length === 1 ? '1 member' : `${shown.length} members`;
  $('#list').innerHTML = shown.length ? shown.map(m => `
    <li><a class="row" href="#/m/${encodeURIComponent(m.id)}">
      <span class="avatar">${esc(initials(m))}</span>
      <span class="grow">
        <strong>${esc(fullName(m))}</strong>
        <span class="muted small">${esc(m.phone || m.email || 'No contact info')}</span>
      </span>
      ${m.active ? '' : '<span class="tag">Inactive</span>'}
    </a></li>`).join('')
    : `<li class="empty">${state.members.length ? 'No one matches that search.' : 'No members yet. Add the first one.'}</li>`;
}

// ---------- One member ----------

function field(label, value) {
  return value ? `<div class="field"><dt>${label}</dt><dd>${value}</dd></div>` : '';
}

function memberScreen(id) {
  const m = findMember(id);
  if (!m) return `${topBar('Member', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  const age = ageFrom(m.date_of_birth);
  const hasEmergency = m.emergency_name || m.emergency_phone;
  return `${topBar('Member', '#/members')}
  <section class="hero">
    <span class="avatar big">${esc(initials(m))}</span>
    <h2>${esc(fullName(m))}</h2>
    ${m.active ? '' : '<span class="tag">Inactive</span>'}
    <div class="actions">
      ${m.phone ? `<a class="btn" href="${esc(telHref(m.phone))}">Call</a>` : ''}
      ${m.email ? `<a class="btn" href="mailto:${esc(m.email)}">Email</a>` : ''}
      <a class="btn primary" href="#/edit/${encodeURIComponent(m.id)}">Edit</a>
    </div>
  </section>

  <h3 class="section">Contact</h3>
  <dl class="card">
    ${field('Phone', esc(m.phone))}
    ${field('Email', esc(m.email))}
    ${field('Address', esc(m.address))}
    ${field('Date of birth', m.date_of_birth ? `${esc(fmtDate(m.date_of_birth))} (age ${age})` : '')}
    ${m.phone || m.email || m.address || m.date_of_birth ? '' : '<p class="muted">No contact info yet.</p>'}
  </dl>

  <h3 class="section">Emergency contact</h3>
  <dl class="card ${hasEmergency ? '' : 'warn'}">
    ${hasEmergency ? `
      ${field('Name', esc(m.emergency_name) + (m.emergency_relation ? ` <span class="muted">(${esc(m.emergency_relation)})</span>` : ''))}
      ${field('Phone', m.emergency_phone ? `<a href="${esc(telHref(m.emergency_phone))}">${esc(m.emergency_phone)}</a>` : '')}`
      : '<p>No emergency contact yet.</p>'}
  </dl>

  <h3 class="section">Classes</h3>
  ${memberClassesCard(m)}

  ${m.notes ? `<h3 class="section">Notes</h3><div class="card pre">${esc(m.notes)}</div>` : ''}`;
}

function memberClassesCard(m) {
  const mine = classesOf(m.id);
  return `<div class="card">
    ${mine.length ? `<ul class="plain">${mine.map(c => `
      <li><a class="line" href="#/c/${encodeURIComponent(c.id)}">
        <strong>${esc(c.name)}</strong>
        <span class="muted small">${esc(fmtSchedule(c))}</span>
      </a></li>`).join('')}</ul>`
      : '<p class="muted">Not in any classes.</p>'}
    <a class="btn small-btn" href="#/join/${encodeURIComponent(m.id)}">+ Add to a class</a>
  </div>`;
}

// ---------- Add a member to a class ----------

function joinScreen(memberId) {
  const m = findMember(memberId);
  if (!m) return `${topBar('Add to a class', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  const inIds = new Set(classesOf(m.id).map(c => c.id));
  const open = sortClasses(state.classes.filter(c => c.active && !inIds.has(c.id)));
  return `${topBar('Add to a class', `#/m/${encodeURIComponent(m.id)}`)}
  <p class="muted center">Pick a class for <strong>${esc(fullName(m))}</strong>.</p>
  <ul class="list">${open.length ? open.map(c => {
    const count = rosterOf(c.id).length;
    const full = c.capacity && count >= c.capacity;
    return `<li><button class="row" data-act="join" data-member="${esc(m.id)}" data-class="${esc(c.id)}">
      <span class="grow">
        <strong>${esc(c.name)}</strong>
        <span class="muted small">${esc(fmtSchedule(c))}</span>
      </span>
      <span class="tag ${full ? 'full' : ''}">${spotsLabel(c, count)}</span>
    </button></li>`;
  }).join('') : `<li class="empty">${state.classes.length ? 'They’re already in every class.' : 'No classes yet. Add them on the Classes tab.'}</li>`}
  </ul>`;
}

async function onJoin(el) {
  const c = findClass(el.dataset.class);
  const count = rosterOf(c.id).length;
  if (c.capacity && count >= c.capacity &&
      !confirm(`${c.name} is full (${count} of ${c.capacity}). Add them anyway?`)) return;
  el.disabled = true;
  try {
    state.enrollments.push(await DB.enroll(el.dataset.member, c.id));
    toast(`Added to ${c.name}`);
    go(`#/m/${encodeURIComponent(el.dataset.member)}`);
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

// ---------- Add / edit ----------

function input(name, label, m, type = 'text', extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(m[name])}" ${extra}></label>`;
}

function formScreen(id) {
  const m = id ? findMember(id) : { active: true };
  if (!m) return `${topBar('Edit member', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  const back = id ? `#/m/${encodeURIComponent(id)}` : '#/members';
  return `${topBar(id ? 'Edit member' : 'New member', back)}
  <form id="member-form" class="stack" data-id="${esc(id || '')}" novalidate>
    <h3 class="section">Name</h3>
    <div class="card stack">
      <div class="two">
        ${input('first_name', 'First name *', m, 'text', 'required autocomplete="off"')}
        ${input('last_name', 'Last name', m, 'text', 'autocomplete="off"')}
      </div>
      ${input('date_of_birth', 'Date of birth', m, 'date')}
    </div>

    <h3 class="section">Contact</h3>
    <div class="card stack">
      ${input('phone', 'Phone', m, 'tel', 'autocomplete="off"')}
      ${input('email', 'Email', m, 'email', 'autocomplete="off"')}
      ${input('address', 'Address', m, 'text', 'autocomplete="off"')}
    </div>

    <h3 class="section">Emergency contact</h3>
    <div class="card stack">
      ${input('emergency_name', 'Name', m, 'text', 'autocomplete="off"')}
      <div class="two">
        ${input('emergency_phone', 'Phone', m, 'tel', 'autocomplete="off"')}
        ${input('emergency_relation', 'Relationship', m, 'text', 'placeholder="e.g. Mum" autocomplete="off"')}
      </div>
    </div>

    <h3 class="section">Notes</h3>
    <div class="card stack">
      <label>Anything staff should know<textarea name="notes" rows="3">${esc(m.notes)}</textarea></label>
      ${id ? `<label class="check"><input name="active" type="checkbox" ${m.active ? 'checked' : ''}>
        Active member <span class="muted small">(untick if they’ve left; nothing is deleted)</span></label>` : ''}
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="${back}">Cancel</a>
      <button class="btn primary" type="submit">${id ? 'Save changes' : 'Add member'}</button>
    </div>
  </form>`;
}

async function onSaveMember(form) {
  const id = form.dataset.id || null;
  const fields = {};
  for (const name of MEMBER_FIELDS) {
    if (name === 'active') continue;
    fields[name] = (form[name].value || '').trim();
  }
  fields.date_of_birth = fields.date_of_birth || null;
  fields.active = id ? form.active.checked : true;

  const problem =
    !fields.first_name ? 'Add a first name.' :
    fields.email && !looksLikeEmail(fields.email) ? 'That email doesn’t look right.' :
    fields.date_of_birth && new Date(fields.date_of_birth) > new Date() ? 'Date of birth is in the future.' : '';
  const errorEl = $('#form-error');
  if (problem) {
    errorEl.textContent = problem;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const saved = await DB.saveMember(id, fields);
    const i = state.members.findIndex(m => m.id === saved.id);
    if (i >= 0) state.members[i] = saved; else state.members.push(saved);
    toast(id ? 'Changes saved' : `${fullName(saved)} added`);
    go(`#/m/${encodeURIComponent(saved.id)}`);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// ---------- Account ----------

function accountScreen() {
  return `${topBar('Your account', '#/members')}
  <div class="card stack">
    <p>Signed in as <strong>${esc(state.user.email)}</strong></p>
    <button class="btn" data-act="sign-out">Sign out</button>
  </div>
  ${DEMO ? `
  <h3 class="section">Demo</h3>
  <div class="card stack">
    <p class="muted small">Undo any test changes and put the made-up members and classes back.</p>
    <button class="btn" data-act="demo-reset">Reset demo data</button>
  </div>` : `
  <h3 class="section">Change password</h3>
  <form id="password-form" class="card stack" novalidate>
    <label>New password<input name="password" type="password" autocomplete="new-password" minlength="8"></label>
    <p id="password-error" class="error" hidden></p>
    <button class="btn primary" type="submit">Change password</button>
  </form>`}`;
}

async function onChangePassword(form) {
  const errorEl = $('#password-error');
  const password = form.password.value;
  if (password.length < 8) {
    errorEl.textContent = 'Use at least 8 characters.';
    errorEl.hidden = false;
    return;
  }
  try {
    await DB.changePassword(password);
    form.reset();
    errorEl.hidden = true;
    toast('Password changed');
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
  }
}

// ---------- Events ----------

// Form id -> submit handler, and data-act -> click handler. classes.js adds its own.
const FORMS = { 'login-form': onLogin, 'member-form': onSaveMember, 'password-form': onChangePassword };

const ACTIONS = {
  filter(el) {
    state.filter = el.dataset.value;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    renderList();
  },
  async 'sign-out'() {
    await DB.signOut();
    Object.assign(state, { user: null, members: [], classes: [], enrollments: [], loaded: false, query: '' });
    go('#/members');
  },
  'demo-reset'() {
    DB.reset();
    state.loaded = false;
    toast('Demo data reset');
    go('#/members');
  },
  join: onJoin,
  retry: render
};

document.addEventListener('submit', (e) => {
  const handler = FORMS[e.target.id];
  if (!handler) return;
  e.preventDefault();
  handler(e.target);
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'search') return;
  state.query = e.target.value;
  renderList();
});

window.addEventListener('hashchange', render);

// Wait for every script (classes.js too) before drawing the first screen.
document.addEventListener('DOMContentLoaded', async function start() {
  try {
    state.user = await DB.currentUser();
  } catch (e) {
    state.loginError = e.message;
  }
  render();
});
