// Follow-ups tab (#/followups): everyone the front desk should contact, each listed once with
// all their reasons and a Call button. Reasons: owes money (any unpaid month since they were
// added), no waiver, or a front desk sign-up still marked "To check".

let followFilter = 'all';   // all | owes | waiver | check

// Active members who need a follow-up, with their reasons, biggest amount owed first.
function followUps() {
  return state.members
    .filter(m => m.active || m.review_note)
    .map(m => {
      const owes = m.active ? unpaidMonths(m).reduce((sum, b) => sum + b.owes, 0) : 0;
      return {
        m, owes,
        noWaiver: m.active && !waiverStatus(m).ok,
        check: !!m.review_note
      };
    })
    .filter(f => f.owes || f.noWaiver || f.check)
    .sort((a, b) => b.owes - a.owes || fullName(a.m).localeCompare(fullName(b.m)));
}

// The number to call: their own, or a parent's for a child with none.
function followPhone(m) {
  if (m.phone) return { number: m.phone, who: '' };
  if (m.guardian_phone) return { number: m.guardian_phone, who: m.guardian_name || 'parent' };
  return null;
}

function followUpsScreen() {
  const all = followUps();
  const counts = {
    all: all.length,
    owes: all.filter(f => f.owes).length,
    waiver: all.filter(f => f.noWaiver).length,
    check: all.filter(f => f.check).length
  };
  const chip = (value, label) =>
    `<button class="chip ${followFilter === value ? 'on' : ''}" data-act="follow-filter" data-value="${value}">${label} (${counts[value]})</button>`;
  return `${topBar('Follow-ups')}
  <p class="muted small center">People to contact: money owed, a missing waiver, or a new sign-up to check.</p>
  <div class="chips">${chip('all', 'All')}${chip('owes', 'Owes')}${chip('waiver', 'No waiver')}${chip('check', 'To check')}</div>
  <ul id="follow-list" class="list follow-list"></ul>`;
}

function renderFollowUps() {
  const keep = { all: () => true, owes: f => f.owes, waiver: f => f.noWaiver, check: f => f.check }[followFilter];
  const shown = followUps().filter(keep);
  $('#follow-list').innerHTML = shown.length ? shown.map(f => {
    const m = f.m;
    const phone = followPhone(m);
    const reasons = [
      f.owes ? `<span class="tag full">Owes ${fmtMoney(f.owes)}</span>` : '',
      f.noWaiver ? '<span class="tag full">No waiver</span>' : '',
      f.check ? '<span class="tag new">To check</span>' : ''
    ].join('');
    return `<li class="row follow-row">
      <a class="row-link" href="#/m/${encodeURIComponent(m.id)}">
        <span class="avatar">${esc(initials(m))}</span>
        <span class="grow">
          <strong>${esc(fullName(m))}</strong>
          <span class="follow-tags">${reasons}</span>
          <span class="muted small wrap">${phone
            ? `${esc(phone.number)}${phone.who ? ` · ${esc(phone.who)} (parent)` : ''}`
            : 'No phone number on file'}</span>
        </span>
      </a>
      ${phone ? `<a class="btn small-btn call-btn" href="${esc(telHref(phone.number))}" aria-label="Call ${esc(fullName(m))}">Call</a>` : ''}
    </li>`;
  }).join('')
    : `<li class="empty">${followFilter === 'all' ? 'Nobody to follow up with right now.' : 'Nobody here right now.'}</li>`;
}

// How many people are waiting, for the tab label.
function followUpCount() {
  return state.loaded ? followUps().length : 0;
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, { followups: { html: followUpsScreen, after: renderFollowUps, tab: 'followups' } });

Object.assign(ACTIONS, {
  'follow-filter'(el) {
    followFilter = el.dataset.value;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    renderFollowUps();
  }
});
