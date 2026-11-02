// Classes and enrolment: #/classes (timetable), #/c/ID (one class and who's in it),
// #/new-class, #/edit-class/ID, #/enroll/ID (add members to a class).

function findClass(id) {
  return state.classes.find(c => c.id === id);
}

// Monday-first by first session, then by its start time. Classes with no days go last.
function sortClasses(list) {
  const first = c => {
    const s = sessionsOf(c)[0];
    return s ? [DAYS.findIndex(([key]) => key === s.day), s.start] : [99, ''];
  };
  return [...list].sort((a, b) => {
    const [da, ta] = first(a);
    const [db, tb] = first(b);
    return da - db || ta.localeCompare(tb) || a.name.localeCompare(b.name);
  });
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
        <span class="muted small">${esc([programLabel(c.program) || 'No charge', c.instructor].filter(Boolean).join(' · '))}</span>
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
    <p>${c.program ? `Program: <strong>${esc(programLabel(c.program))}</strong>`
      : '<span class="muted">No charge (not part of a paid program)</span>'}</p>
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
  const sessions = sessionsOf(c);
  const sessionFor = key => sessions.find(s => s.day === key);
  return `${topBar(id ? 'Edit class' : 'New class', back)}
  <form id="class-form" class="stack" data-id="${esc(id || '')}" novalidate>
    <div class="card stack">
      <label>Class name *<input name="name" value="${esc(c.name)}" placeholder="e.g. Kids Kickboxing" autocomplete="off"></label>
      <label><span>Program <span class="muted small">(sets what members pay)</span></span>
        <select name="program">
          ${PROGRAMS.map(([key, label]) => `<option value="${key}" ${c.program === key ? 'selected' : ''}>${label}</option>`).join('')}
          <option value="" ${id && !c.program ? 'selected' : ''}>No charge (e.g. open mat)</option>
        </select>
      </label>
      <fieldset class="sessions">
        <legend>Days and times <span class="muted small">(tap a day, then set its times)</span></legend>
        ${DAYS.map(([key, label]) => {
          const s = sessionFor(key);
          return `<div class="session-row ${s ? 'on' : ''}">
            <label class="day"><input type="checkbox" name="days" value="${key}" ${s ? 'checked' : ''}>
              <span>${label}</span></label>
            <input name="start_${key}" type="time" value="${esc(s ? s.start : '')}" aria-label="${label} start time">
            <span class="to" aria-hidden="true">–</span>
            <input name="end_${key}" type="time" value="${esc(s ? s.end : '')}" aria-label="${label} end time">
          </div>`;
        }).join('')}
      </fieldset>
      <div class="two">
        <label>Instructor<input name="instructor" value="${esc(c.instructor)}" autocomplete="off"></label>
        <label>Max people<input name="capacity" type="number" min="1" inputmode="numeric"
          value="${esc(c.capacity || '')}" placeholder="No limit"></label>
      </div>
      <label>Notes<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>
      ${id ? `<label class="check"><input name="active" type="checkbox" ${c.active ? 'checked' : ''}>
        Running <span class="muted small">(untick if it’s stopped; it keeps its history)</span></label>` : ''}
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="${back}">Cancel</a>
      <button class="btn primary" type="submit">${id ? 'Save changes' : 'Add class'}</button>
    </div>
  </form>
  ${id ? deleteClassCard(c) : ''}`;
}

// Delete is only offered when no current members are in the class. Classes with people in
// them should be marked "not running" instead, which keeps their history.
function deleteClassCard(c) {
  const count = rosterOf(c.id).length;
  return `<h3 class="section">Delete class</h3>
  <div class="card stack">
    ${count ? `<p class="muted small">${count === 1 ? '1 person is' : `${count} people are`} in this class.
      To delete it, take everyone out first, or just untick “Running” above.</p>`
      : `<p class="muted small">Removes this class completely. This can’t be undone.</p>
      <button class="btn danger" type="button" data-act="delete-class" data-id="${esc(c.id)}">Delete class</button>`}
  </div>`;
}

async function onDeleteClass(el) {
  const c = findClass(el.dataset.id);
  if (!c || rosterOf(c.id).length) return;
  // Members who have left can still be listed in the class behind the scenes.
  const leftovers = state.enrollments.filter(e => e.class_id === c.id);
  const extra = leftovers.length
    ? `\n\n${leftovers.length === 1 ? '1 former member is' : `${leftovers.length} former members are`} still listed in it and will be taken out too.`
    : '';
  if (!confirm(`Delete “${c.name}”? This can’t be undone.${extra}`)) return;
  el.disabled = true;
  try {
    for (const e of leftovers) await DB.unenroll(e.member_id, c.id);
    state.enrollments = state.enrollments.filter(e => e.class_id !== c.id);
    await DB.deleteClass(c.id);
    state.classes = state.classes.filter(x => x.id !== c.id);
    toast(`${c.name} deleted`);
    go('#/classes');
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

async function onSaveClass(form) {
  const id = form.dataset.id || null;
  const capacity = form.capacity.value.trim();
  const sessions = [...form.querySelectorAll('input[name=days]:checked')].map(i => ({
    day: i.value,
    start: form[`start_${i.value}`].value,
    end: form[`end_${i.value}`].value
  }));
  const fields = {
    name: form.querySelector('[name=name]').value.trim(),   // form.name is the form's own name
    program: form.program.value || null,
    sessions,
    // Kept in step with the first session, for older parts of the app and backups.
    days: sessions.map(s => s.day),
    start_time: sessions[0]?.start || null,
    end_time: sessions[0]?.end || null,
    instructor: form.instructor.value.trim(),
    capacity: capacity ? Number(capacity) : null,
    notes: form.notes.value.trim(),
    active: id ? form.active.checked : true
  };

  const backwards = sessions.find(s => s.start && s.end && s.end <= s.start);
  const problem =
    !fields.name ? 'Add a class name.' :
    fields.capacity !== null && !(Number.isInteger(fields.capacity) && fields.capacity > 0)
      ? 'Max people should be a whole number, or leave it empty for no limit.' :
    backwards ? `On ${fmtDays([backwards.day])}, the end time is before the start time.` : '';
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
Object.assign(ACTIONS, { enroll: onEnroll, unenroll: onUnenroll, 'delete-class': onDeleteClass });

// Ticking a day shows its times. To save typing, a newly ticked day with no times copies
// them from the nearest ticked day above it (or below, if it's the first).
document.addEventListener('change', (e) => {
  if (e.target.name !== 'days' || !e.target.closest('#class-form')) return;
  const row = e.target.closest('.session-row');
  row.classList.toggle('on', e.target.checked);
  const [start, end] = row.querySelectorAll('input[type=time]');
  if (!e.target.checked || start.value || end.value) return;
  const rows = [...document.querySelectorAll('.session-row.on')].filter(r => r !== row);
  const before = rows.filter(r => r.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);
  const from = before.pop() || rows[0];
  if (!from) return;
  const [fs, fe] = from.querySelectorAll('input[type=time]');
  start.value = fs.value;
  end.value = fe.value;
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'pick-search') return;
  pickQuery = e.target.value;
  renderPickList(route().id);
});
