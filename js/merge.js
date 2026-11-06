// Merging duplicates (#/merge/KEEP_ID): when one person is in the app twice, staff pick the
// duplicate, see exactly what will happen, and merge it into the member they started from.
// The merge itself is one all-or-nothing step in the database (merge_members in schema.sql):
// blank details are filled from the duplicate, its waivers, payments, classes, pauses and
// reminders move over, and the duplicate is removed.

let mergeDupId = null;     // the duplicate picked on this screen
let mergeQuery = '';

const MERGE_FIELD_LABELS = {
  last_name: 'Last name', email: 'Email', phone: 'Phone', alt_phone: 'Alt phone',
  date_of_birth: 'Date of birth', sex: 'Sex', address: 'Street address', city: 'City',
  state: 'State', zip: 'Zip', medical: 'Medical conditions', emergency_name: 'Emergency contact',
  emergency_relation: 'Emergency relation', emergency_phone: 'Emergency phone',
  emergency_alt_phone: 'Emergency alt phone', guardian_name: 'Parent/guardian',
  guardian_relation: 'Parent relation', guardian_phone: 'Parent phone', guardian_email: 'Parent email'
};

// Other members who might be the same person, most likely first.
function likelyDuplicates(keep) {
  const low = s => String(s || '').trim().toLowerCase();
  const digits = s => String(s || '').replace(/\D/g, '');
  return state.members
    .filter(m => m.id !== keep.id)
    .map(m => {
      let score = 0;
      if (low(fullName(m)) === low(fullName(keep))) score += 3;
      else if (low(m.last_name) && low(m.last_name) === low(keep.last_name)) score += 1;
      if (keep.date_of_birth && m.date_of_birth === keep.date_of_birth) score += 2;
      if (digits(keep.phone).length >= 7 && digits(m.phone) === digits(keep.phone)) score += 2;
      if (low(keep.email) && low(m.email) === low(keep.email)) score += 2;
      return { m, score };
    })
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map(x => x.m);
}

function mergeScreen(keepId) {
  const keep = findMember(keepId);
  if (!keep) return `${topBar('Merge duplicate', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  mergeDupId = null;
  mergeQuery = '';
  const likely = likelyDuplicates(keep);
  return `${topBar('Merge duplicate', `#/edit/${encodeURIComponent(keep.id)}`)}
  <div class="card stack">
    <p>Keeping <strong>${esc(fullName(keep))}</strong>${mergeDetails(keep)}</p>
    <p class="muted small">Pick the duplicate record below. Its details, waivers, payments and classes
      are moved into ${esc(keep.first_name)}’s record, then the duplicate is removed.</p>
  </div>
  ${likely.length ? `<h3 class="section">Likely duplicates</h3>
    <ul class="list">${likely.map(mergeRow).join('')}</ul>` : ''}
  <h3 class="section">Or search everyone</h3>
  <div class="tools">
    <input id="merge-search" type="search" placeholder="Search name" autocomplete="off" aria-label="Search members">
  </div>
  <ul id="merge-results" class="list"></ul>
  <div id="merge-preview"></div>`;
}

// "· 555-0101 · born Apr 12, 1990"
function mergeDetails(m) {
  const bits = [m.phone, m.date_of_birth ? `born ${fmtDate(m.date_of_birth)}` : '', m.active ? '' : 'inactive']
    .filter(Boolean);
  return bits.length ? ` <span class="muted small">· ${esc(bits.join(' · '))}</span>` : '';
}

function mergeRow(m) {
  return `<li><button class="row ${mergeDupId === m.id ? 'picked' : ''}" data-act="merge-pick" data-id="${esc(m.id)}">
    <span class="avatar">${esc(initials(m))}</span>
    <span class="grow"><strong>${esc(fullName(m))}</strong>
      <span class="muted small wrap">${esc([m.phone, m.email, m.date_of_birth ? `born ${fmtDate(m.date_of_birth)}` : '']
        .filter(Boolean).join(' · ') || 'No details')}</span></span>
    ${m.active ? '' : '<span class="tag">Inactive</span>'}
  </button></li>`;
}

function renderMergeResults(keepId) {
  const q = mergeQuery.trim().toLowerCase();
  $('#merge-results').innerHTML = q
    ? (state.members.filter(m => m.id !== keepId && fullName(m).toLowerCase().includes(q)).slice(0, 20)
        .map(mergeRow).join('') || '<li class="empty">No one matches that search.</li>')
    : '';
}

// What will happen, before anything is changed.
function renderMergePreview(keepId) {
  const keep = findMember(keepId);
  const dup = findMember(mergeDupId);
  const box = $('#merge-preview');
  if (!keep || !dup) { box.innerHTML = ''; return; }
  const fills = Object.keys(MERGE_FIELD_LABELS).filter(k => !keep[k] && dup[k]);
  const count = (list, word) => {
    const n = list.filter(r => r.member_id === dup.id).length;
    return n ? `${n} ${word}${n === 1 ? '' : 's'}` : '';
  };
  const moves = [count(state.waivers, 'waiver'), count(state.payments, 'payment'),
    count(state.enrollments, 'class sign-up'), count(state.pauses, 'pause')].filter(Boolean);
  const takesPlan = (keep.plan || 'auto') === 'auto' && (dup.plan || 'auto') !== 'auto';
  box.innerHTML = `<h3 class="section">Check before merging</h3>
  <div class="card stack merge-preview">
    <p>Merge <strong>${esc(fullName(dup))}</strong> into <strong>${esc(fullName(keep))}</strong>.</p>
    <ul class="small merge-list">
      <li>${fills.length ? `Fills in ${esc(keep.first_name)}’s blank ${esc(fills.map(k => MERGE_FIELD_LABELS[k].toLowerCase()).join(', '))}.`
        : 'No details to fill in. Anything already filled in stays as it is.'}</li>
      <li>${moves.length ? `Moves ${esc(moves.join(', '))}.` : 'Nothing else to move.'}</li>
      ${takesPlan ? `<li>Takes their plan (${esc(planFor(dup).label)}), since ${esc(keep.first_name)} has none chosen.</li>` : ''}
      <li>Then removes the duplicate record. This can’t be undone.</li>
    </ul>
    <button class="btn primary" data-act="merge-go" data-keep="${esc(keep.id)}">Merge into ${esc(fullName(keep))}</button>
  </div>`;
  box.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

async function onMergeGo(el) {
  const keep = findMember(el.dataset.keep);
  const dup = findMember(mergeDupId);
  if (!keep || !dup) return;
  if (!confirm(`Merge ${fullName(dup)} into ${fullName(keep)}? The duplicate record will be removed.`)) return;
  el.disabled = true;
  el.textContent = 'Merging…';
  try {
    await DB.mergeMembers(keep.id, dup.id);
    await loadAll();
    toast(`Merged into ${fullName(keep)}`);
    go(`#/m/${encodeURIComponent(keep.id)}`);
  } catch (e) {
    toast(e.message);
    el.disabled = false;
    el.textContent = `Merge into ${fullName(keep)}`;
  }
}

// Shown on the member's Edit screen, above Delete.
function mergeCard(m) {
  return `<h3 class="section">Duplicate?</h3>
  <div class="card stack">
    <p class="small">If ${esc(m.first_name)} is in the app twice, merge the other record into this one. Their
      waivers, payments and classes are kept.</p>
    <a class="btn" href="#/merge/${encodeURIComponent(m.id)}">Merge a duplicate into this member</a>
  </div>`;
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, { merge: { html: mergeScreen } });

Object.assign(ACTIONS, {
  'merge-pick'(el) {
    mergeDupId = el.dataset.id;
    const keepId = route().id;
    document.querySelectorAll('[data-act=merge-pick]').forEach(b => b.classList.toggle('picked', b.dataset.id === mergeDupId));
    renderMergePreview(keepId);
  },
  'merge-go': onMergeGo
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'merge-search') return;
  mergeQuery = e.target.value;
  renderMergeResults(route().id);
});
