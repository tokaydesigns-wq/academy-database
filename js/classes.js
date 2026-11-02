// Classes and enrolment: #/classes (timetable), #/c/ID (one class and who's in it),
// #/new-class, #/edit-class/ID, #/enroll/ID (add members to a class).

function findClass(id) {
  return state.classes.find(c => c.id === id);
}

// Monday-first by first day, then by start time. Classes with no days go last.
function sortClasses(list) {
  const dayIndex = c => {
    const i = DAYS.findIndex(([key]) => (c.days || []).includes(key));
    return i < 0 ? 99 : i;
  };
  return [...list].sort((a, b) =>
    dayIndex(a) - dayIndex(b) || (a.start_time || '').localeCompare(b.start_time || '') ||
    a.name.localeCompare(b.name));
}

// Active members in a class. Members who've left stay enrolled but aren't shown or counted.
function rosterOf(classId) {
  const ids = new Set(state.enrollments.filter(e => e.class_id === classId).map(e => e.member_id));
  return state.members.filter(m => m.active && ids.has(m.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
}

// Running classes a member is in.
function classesOf(memberId) {
  const ids = new Set(state.enrollments.filter(e => e.member_id === memberId).map(e => e.class_id));
  return sortClasses(state.classes.filter(c => c.active && ids.has(c.id)));
}

// "8 of 12", "Full", or just "8 in class" when there's no limit.
function spotsLabel(c, count) {
  if (!c.capacity) return `${count} in class`;
  return count >= c.capacity ? `Full (${count} of ${c.capacity})` : `${count} of ${c.capacity}`;
}

// ---------- Timetable ----------

function classesScreen() {
  const running = sortClasses(state.classes.filter(c => c.active));
  const stopped = sortClasses(state.classes.filter(c => !c.active));
  const row = c => {
    const count = rosterOf(c.id).length;
    const full = c.capacity && count >= c.capacity;
    return `<li><a class="row" href="#/c/${encodeURIComponent(c.id)}">
      <span class="grow">
        <strong>${esc(c.name)}</strong>
        <span class="muted small">${esc(fmtSchedule(c))}</span>
        ${c.instructor ? `<span class="muted small">${esc(c.instructor)}</span>` : ''}
      </span>
      <span class="tag ${full ? 'full' : ''}">${spotsLabel(c, count)}</span>
    </a></li>`;
  };
  return `${topBar('Classes')}
  <ul class="list">${running.length ? running.map(row).join('')
    : '<li class="empty">No classes yet. Add the first one.</li>'}</ul>
  ${stopped.length ? `<h3 class="section">Not running</h3>
    <ul class="list faded">${stopped.map(row).join('')}</ul>` : ''}
  <a class="fab" href="#/new-class">+ Add class</a>`;
}

// ---------- One class ----------

function classScreen(id) {
  const c = findClass(id);
  if (!c) return `${topBar('Class', '#/classes')}<p class="empty">This class wasn’t found.</p>`;
  const roster = rosterOf(c.id);
  const full = c.capacity && roster.length >= c.capacity;
  return `${topBar('Class', '#/classes')}
  <section class="hero">
    <h2>${esc(c.name)}</h2>
    <p class="muted">${esc(fmtSchedule(c))}</p>
    ${c.instructor ? `<p>Instructor: <strong>${esc(c.instructor)}</strong></p>` : ''}
    ${c.active ? '' : '<span class="tag">Not running</span>'}
    <div class="actions">
      <a class="btn primary" href="#/enroll/${encodeURIComponent(c.id)}">+ Add members</a>
      <a class="btn" href="#/edit-class/${encodeURIComponent(c.id)}">Edit</a>
    </div>
  </section>

  <h3 class="section">Who’s in it <span class="tag ${full ? 'full' : ''}">${spotsLabel(c, roster.length)}</span></h3>
  <ul class="list">${roster.length ? roster.map(m => `
    <li class="row">
      <a class="row-link" href="#/m/${encodeURIComponent(m.id)}">
        <span class="avatar">${esc(initials(m))}</span>
        <span class="grow">
          <strong>${esc(fullName(m))}</strong>
          <span class="muted small">${esc(m.phone || m.email || '')}</span>
        </span>
      </a>
      <button class="icon-btn remove" data-act="unenroll" data-member="${esc(m.id)}" data-class="${esc(c.id)}"
        aria-label="Take ${esc(fullName(m))} out of this class">✕</button>
    </li>`).join('') : '<li class="empty">No one is in this class yet.</li>'}
  </ul>

  ${c.notes ? `<h3 class="section">Notes</h3><div class="card pre">${esc(c.notes)}</div>` : ''}`;
}

async function onUnenroll(el) {
  const m = findMember(el.dataset.member);
  const c = findClass(el.dataset.class);
  if (!confirm(`Take ${fullName(m)} out of ${c.name}?`)) return;
  el.disabled = true;
  try {
    await DB.unenroll(m.id, c.id);
    state.enrollments = state.enrollments.filter(e => !(e.member_id === m.id && e.class_id === c.id));
    toast(`${fullName(m)} taken out of ${c.name}`);
    render();
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

// ---------- Add members to a class ----------

let pickQuery = '';

function enrollScreen(id) {
  const c = findClass(id);
  if (!c) return `${topBar('Add members', '#/classes')}<p class="empty">This class wasn’t found.</p>`;
  pickQuery = '';
  return `${topBar('Add members', `#/c/${encodeURIComponent(c.id)}`)}
  <p class="muted center">Tap a member to add them to <strong>${esc(c.name)}</strong>.</p>
  <div class="tools">
    <input id="pick-search" type="search" placeholder="Search name" autocomplete="off" aria-label="Search members">
  </div>
  <p id="pick-spots" class="muted small"></p>
  <ul id="pick-list" class="list"></ul>
  <p class="center"><a class="btn" href="#/c/${encodeURIComponent(c.id)}">Done</a></p>`;
}

// Redraws the pick list only, so the search box keeps focus.
function renderPickList(id) {
  const c = findClass(id);
  if (!c) return;
  const inIds = new Set(rosterOf(c.id).map(m => m.id));
  const q = pickQuery.trim().toLowerCase();
  const left = state.members
    .filter(m => m.active && !inIds.has(m.id) && fullName(m).toLowerCase().includes(q))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  $('#pick-spots').textContent = spotsLabel(c, inIds.size);
  $('#pick-list').innerHTML = left.length ? left.map(m => `
    <li><button class="row" data-act="enroll" data-member="${esc(m.id)}" data-class="${esc(c.id)}">
      <span class="avatar">${esc(initials(m))}</span>
      <span class="grow"><strong>${esc(fullName(m))}</strong></span>
      <span class="add">+ Add</span>
    </button></li>`).join('')
    : `<li class="empty">${q ? 'No one matches that search.' : 'Every active member is already in this class.'}</li>`;
}

async function onEnroll(el) {
  const m = findMember(el.dataset.member);
  const c = findClass(el.dataset.class);
  const count = rosterOf(c.id).length;
  if (c.capacity && count >= c.capacity &&
      !confirm(`${c.name} is full (${count} of ${c.capacity}). Add ${fullName(m)} anyway?`)) return;
  el.disabled = true;
  try {
    state.enrollments.push(await DB.enroll(m.id, c.id));
    toast(`${fullName(m)} added`);
    renderPickList(c.id);
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

// ---------- Add / edit a class ----------

function classFormScreen(id) {
  const c = id ? findClass(id) : { active: true, days: [] };
  if (!c) return `${topBar('Edit class', '#/classes')}<p class="empty">This class wasn’t found.</p>`;
  const back = id ? `#/c/${encodeURIComponent(id)}` : '#/classes';
  const days = c.days || [];
  return `${topBar(id ? 'Edit class' : 'New class', back)}
  <form id="class-form" class="stack" data-id="${esc(id || '')}" novalidate>
    <div class="card stack">
      <label>Class name *<input name="name" value="${esc(c.name)}" placeholder="e.g. Kids Class" autocomplete="off"></label>
      <fieldset class="days">
        <legend>Days</legend>
        ${DAYS.map(([key, label]) => `
          <label class="day"><input type="checkbox" name="days" value="${key}" ${days.includes(key) ? 'checked' : ''}>
          <span>${label}</span></label>`).join('')}
      </fieldset>
      <div class="two">
        <label>Starts<input name="start_time" type="time" value="${esc((c.start_time || '').slice(0, 5))}"></label>
        <label>Ends<input name="end_time" type="time" value="${esc((c.end_time || '').slice(0, 5))}"></label>
      </div>
      <div class="two">
        <label>Instructor<input name="instructor" value="${esc(c.instructor)}" autocomplete="off"></label>
        <label>Max people<input name="capacity" type="number" min="1" inputmode="numeric"
          value="${esc(c.capacity || '')}" placeholder="No limit"></label>
      </div>
      <label>Notes<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>
      ${id ? `<label class="check"><input name="active" type="checkbox" ${c.active ? 'checked' : ''}>
        Running <span class="muted small">(untick if it’s stopped; nothing is deleted)</span></label>` : ''}
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="${back}">Cancel</a>
      <button class="btn primary" type="submit">${id ? 'Save changes' : 'Add class'}</button>
    </div>
  </form>`;
}

async function onSaveClass(form) {
  const id = form.dataset.id || null;
  const capacity = form.capacity.value.trim();
  const fields = {
    name: form.querySelector('[name=name]').value.trim(),   // form.name is the form's own name
    days: [...form.querySelectorAll('input[name=days]:checked')].map(i => i.value),
    start_time: form.start_time.value || null,
    end_time: form.end_time.value || null,
    instructor: form.instructor.value.trim(),
    capacity: capacity ? Number(capacity) : null,
    notes: form.notes.value.trim(),
    active: id ? form.active.checked : true
  };

  const problem =
    !fields.name ? 'Add a class name.' :
    fields.capacity !== null && !(Number.isInteger(fields.capacity) && fields.capacity > 0)
      ? 'Max people should be a whole number, or leave it empty for no limit.' :
    fields.start_time && fields.end_time && fields.end_time <= fields.start_time
      ? 'The end time is before the start time.' : '';
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
    const saved = await DB.saveClass(id, fields);
    const i = state.classes.findIndex(c => c.id === saved.id);
    if (i >= 0) state.classes[i] = saved; else state.classes.push(saved);
    toast(id ? 'Changes saved' : `${saved.name} added`);
    go(`#/c/${encodeURIComponent(saved.id)}`);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, {
  classes: { html: classesScreen, tab: 'classes' },
  c: { html: classScreen },
  'new-class': { html: () => classFormScreen(null) },
  'edit-class': { html: classFormScreen },
  enroll: { html: enrollScreen, after: renderPickList }
});

FORMS['class-form'] = onSaveClass;
Object.assign(ACTIONS, { enroll: onEnroll, unenroll: onUnenroll });

document.addEventListener('input', (e) => {
  if (e.target.id !== 'pick-search') return;
  pickQuery = e.target.value;
  renderPickList(route().id);
});
