// Payments: what each member owes per month, the Payments tab (#/payments), and recording a
// payment (#/pay/MEMBER_ID). Only records money received; never card or bank details.

// Plans staff can pick directly, and the premium programs each one includes.
// Kickboxing is included in all of them.
const PROGRAM_PLANS = {
  kickboxing: [],
  muay_thai: ['muay_thai'],
  jiu_jitsu: ['jiu_jitsu'],
  all: ['muay_thai', 'jiu_jitsu']
};

// Price and name for a set of premium programs: Muay Thai or Jiu Jitsu include Kickboxing,
// and each extra course is +$10. No premium programs means Kickboxing only.
function programPrice(premium) {
  if (!premium.length) return { cents: PRICES.kickboxing, label: 'Kickboxing only' };
  return { cents: PRICES.premium + PRICES.extraCourse * (premium.length - 1),
    label: premium.length === PREMIUM.length ? 'All 3 (Muay Thai + Jiu Jitsu + Kickboxing)'
      : premium.map(programLabel).join(' + ') + ' (Kickboxing included)' };
}

// Premium programs a member's classes use that their chosen plan doesn't include, e.g. someone
// on "Kickboxing only" who's in a Muay Thai class. Empty when everything matches.
function planMismatch(m) {
  const included = PROGRAM_PLANS[m.plan];
  if (!included) return [];
  const programs = new Set(classesOf(m.id).map(c => c.program));
  return PREMIUM.filter(p => programs.has(p) && !included.includes(p));
}

// What a member owes each month and why. Prices come from PRICES in core.js.
function planFor(m) {
  if (PROGRAM_PLANS[m.plan]) return programPrice(PROGRAM_PLANS[m.plan]);
  if (m.plan === 'covered') {
    const payer = findMember(m.paid_by);
    return { cents: 0, label: `On ${payer ? fullName(payer) : 'a family member'}’s family plan` };
  }
  if (m.plan === 'family') {
    const covered = familyOf(m.id);
    return { cents: PRICES.family,
      label: 'Family plan' + (covered.length ? ` (also covers ${covered.map(c => c.first_name).join(', ')})` : '') };
  }
  if (m.plan === 'custom') return { cents: toCents(m.custom_price), label: 'Custom price' };

  // Worked out from their classes: Muay Thai and Jiu Jitsu include Kickboxing, +$10 per extra course.
  const programs = new Set(classesOf(m.id).map(c => c.program).filter(Boolean));
  const premium = PREMIUM.filter(p => programs.has(p));
  if (premium.length || programs.has('kickboxing')) return programPrice(premium);
  return { cents: 0, label: 'No paid classes yet' };
}

// Active members on this member's family plan.
function familyOf(payerId) {
  return state.members.filter(m => m.active && m.plan === 'covered' && m.paid_by === payerId);
}

function paymentsOf(memberId) {
  return state.payments.filter(p => p.member_id === memberId)
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at));
}

// "2026-11-02T18:00:00Z" -> "2026-11", in local time.
function monthOf(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The month they were added to the app ("2026-11"). Nothing is due before it.
function joinedMonth(m) {
  return monthOf(m.created_at);
}

// For members who've left: the first month they're no longer billed. Members marked as left
// before this was tracked use the month after they were last edited.
function leftMonth(m) {
  if (m.active) return null;
  return m.inactive_since || shiftMonth(monthOf(m.updated_at || m.created_at), 1);
}

// The pause covering this month, if any. A pause with no end_month runs until they're resumed.
function pauseFor(m, month) {
  return state.pauses.find(p => p.member_id === m.id && p.start_month <= month &&
    (!p.end_month || month <= p.end_month));
}

// The pause that's running now or starts later (the one staff would edit or end), if any.
function currentPause(m) {
  const now = thisMonth();
  return state.pauses
    .filter(p => p.member_id === m.id && (!p.end_month || p.end_month >= now))
    .sort((a, b) => a.start_month.localeCompare(b.start_month))[0];
}

// { due, paid, owes, why } in cents for one month. Nothing is due before they joined, while
// their plan is paused, or after they left. Past months use their current plan's price.
function statusFor(m, month) {
  const paid = state.payments
    .filter(p => p.member_id === m.id && p.covers_month === month)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  const left = leftMonth(m);
  const why = month < joinedMonth(m) ? 'before'
    : left && month >= left ? 'left'
    : pauseFor(m, month) ? 'paused' : '';
  const due = why ? 0 : planFor(m).cents;
  return { due, paid, owes: Math.max(due - paid, 0), why };
}

// Months since they joined (up to this one) that aren't fully paid, newest first.
function unpaidMonths(m) {
  const months = [];
  for (let month = joinedMonth(m); month <= thisMonth(); month = shiftMonth(month, 1)) {
    const s = statusFor(m, month);
    if (s.owes) months.push({ month, owes: s.owes });
  }
  return months.reverse();
}

function statusText(s) {
  if (s.why === 'paused') return 'Plan paused, nothing due';
  if (s.why === 'before') return 'Not added yet';
  if (s.why === 'left') return 'Left the gym, not billed';
  if (!s.due) return s.paid ? `Paid ${fmtMoney(s.paid)}` : 'Nothing due';
  if (!s.owes) return `Paid ✓`;
  return s.paid ? `Owes ${fmtMoney(s.owes)} (paid ${fmtMoney(s.paid)})` : `Owes ${fmtMoney(s.owes)}`;
}

// ---------- On the member page ----------

function memberPaymentsCard(m) {
  const plan = planFor(m);
  const month = thisMonth();
  const s = statusFor(m, month);
  const recent = paymentsOf(m.id).slice(0, 6);
  const extra = planMismatch(m);
  const behind = unpaidMonths(m);
  const total = behind.reduce((sum, b) => sum + b.owes, 0);
  return `<div class="card">
    ${pauseBanner(m)}
    ${extra.length ? `<p class="mismatch">In a ${esc(extra.map(programLabel).join(' and '))} class, but their plan
      doesn’t include it. Check their plan or their classes.</p>` : ''}
    <dl>
      ${field('Plan', `${esc(plan.label)}${plan.cents ? ` · <strong>${fmtMoney(plan.cents)}/mo</strong>` : ''}`)}
      ${field(esc(fmtMonth(month)), `<span class="${s.owes ? 'owes' : 'paid'}">${esc(statusText(s))}</span>`)}
      ${behind.length > 1 || (behind.length === 1 && behind[0].month !== month)
        ? field('Unpaid months', `<span class="owes">${fmtMoney(total)} total</span><br>
          <span class="small">${behind.map(b => `${esc(fmtMonth(b.month))}: ${fmtMoney(b.owes)}`).join('<br>')}</span>`) : ''}
      ${s.owes ? field('Reminder', esc(reminderNote(m, month))) : ''}
      ${field('Billing since', esc(fmtMonth(joinedMonth(m))))}
      ${m.active ? '' : field('Left', `Not billed from ${esc(fmtMonth(leftMonth(m)))}`)}
    </dl>
    ${recent.length ? `<ul class="plain pay-list">${recent.map(p => `
      <li class="pay-row">
        <span class="grow">
          <strong>${fmtMoney(toCents(p.amount))}</strong>
          <span class="muted small">${esc(fmtDate(p.paid_on))} · ${esc(methodLabel(p.method))} · for ${esc(fmtMonth(p.covers_month))}${p.note ? ` · ${esc(p.note)}` : ''}</span>
        </span>
        <button class="icon-btn remove" data-act="delete-payment" data-id="${esc(p.id)}"
          aria-label="Remove this payment">✕</button>
      </li>`).join('')}</ul>` : '<p class="muted pay-none">No payments recorded yet.</p>'}
    <div class="actions start">
      <a class="btn small-btn" href="#/pay/${encodeURIComponent(m.id)}" data-act="pay-from-member">+ Record payment</a>
      ${currentPause(m) ? '' : `<a class="btn small-btn" href="#/pause/${encodeURIComponent(m.id)}">⏸ Pause plan</a>`}
    </div>
  </div>`;
}

// The reminder email for this month (sent on the 15th by the Gmail script in reminders/).
function reminderFor(m, month) {
  return state.reminders.find(r => r.member_id === m.id && r.month === month);
}

// What staff need to know about the reminder for someone who owes. Nothing while reminders
// are switched off in config.js.
function reminderNote(m, month) {
  if (!CONFIG.remindersOn) return '';
  const sent = reminderFor(m, month);
  if (sent) return `✉ Reminder emailed ${fmtDate(sent.sent_at)}`;
  if (!looksLikeEmail(m.email || m.guardian_email || '')) return '⚠ No email on file, so no reminder. Call them instead.';
  return month === thisMonth() && new Date().getDate() < 15 ? 'Reminder goes out on the 15th if still unpaid' : '';
}

// "Paused Nov 2026 – Dec 2026" (or "from Nov 2026, no return date yet"), with edit/end buttons.
function pauseBanner(m) {
  const p = currentPause(m);
  if (!p) return '';
  const now = thisMonth();
  const started = p.start_month <= now;
  const when = p.end_month
    ? `${fmtMonth(p.start_month)} to ${fmtMonth(p.end_month)}, back in ${fmtMonth(shiftMonth(p.end_month, 1))}`
    : `from ${fmtMonth(p.start_month)}, no return date yet`;
  return `<div class="pause-banner">
    <strong>⏸ ${started ? 'Plan paused' : 'Pause planned'}</strong>
    <span class="small">${esc(when)}${p.note ? ` · ${esc(p.note)}` : ''}</span>
    <span class="small muted">Nothing is due while paused. Their details and classes are kept.</span>
    <div class="actions start">
      <a class="btn small-btn" href="#/pause/${encodeURIComponent(m.id)}">Change</a>
      ${started ? `<button class="btn small-btn" data-act="resume" data-id="${esc(p.id)}">▶ They’re back</button>`
        : `<button class="btn small-btn" data-act="cancel-pause" data-id="${esc(p.id)}">Cancel pause</button>`}
    </div>
  </div>`;
}

async function onDeletePayment(el) {
  const p = state.payments.find(x => x.id === el.dataset.id);
  if (!p || !confirm(`Remove this ${fmtMoney(toCents(p.amount))} payment? Only do this if it was entered by mistake.`)) return;
  el.disabled = true;
  try {
    await DB.deletePayment(p.id);
    state.payments = state.payments.filter(x => x.id !== p.id);
    toast('Payment removed');
    render();
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

// ---------- Plan fields on the member form ----------

function planFieldsHtml(m, id) {
  const plan = m.plan || 'auto';
  const payers = state.members.filter(x => x.active && x.plan === 'family' && x.id !== id)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const opt = (value, label) => `<option value="${value}" ${plan === value ? 'selected' : ''}>${label}</option>`;
  return `<div class="card stack">
    <label>Plan
      <select name="plan" id="plan-select">
        ${Object.entries(PROGRAM_PLANS).map(([key, premium]) => {
          const p = programPrice(premium);
          return opt(key, `${p.label} · ${fmtMoney(p.cents)}`);
        }).join('')}
        ${opt('family', `Family plan · ${fmtMoney(PRICES.family)} (pays for the family)`)}
        ${opt('covered', 'On someone else’s family plan')}
        ${opt('custom', 'Custom price')}
        ${opt('auto', 'Work it out from their classes')}
      </select>
    </label>
    <label data-plan="covered">Family plan paid by
      <select name="paid_by">
        <option value="">Choose…</option>
        ${payers.map(p => `<option value="${esc(p.id)}" ${m.paid_by === p.id ? 'selected' : ''}>${esc(fullName(p))}</option>`).join('')}
      </select>
      ${payers.length ? '' : '<span class="muted small">No one has a family plan yet. Set it on the parent who pays first.</span>'}
    </label>
    <label data-plan="custom">Monthly price ($)
      <input name="custom_price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(m.custom_price ?? '')}">
    </label>
    <p class="muted small" data-plan="auto">The price follows the classes they’re in, using the same
      prices as the plans above.</p>
  </div>`;
}

// Show only the extra field that goes with the chosen plan.
function syncPlanFields() {
  const select = $('#plan-select');
  if (!select) return;
  document.querySelectorAll('[data-plan]').forEach(el => { el.hidden = el.dataset.plan !== select.value; });
}

function readPlanFields(form) {
  const plan = form.plan.value;
  const fields = { plan, paid_by: null, custom_price: null };
  let problem = '';
  if (plan === 'covered') {
    fields.paid_by = form.paid_by.value || null;
    if (!fields.paid_by) problem = 'Choose who pays the family plan.';
  }
  if (plan === 'custom') {
    const price = form.custom_price.value.trim();
    fields.custom_price = price === '' ? null : Number(price);
    if (fields.custom_price === null || !(fields.custom_price >= 0)) problem = 'Enter the custom monthly price.';
  }
  return { fields, problem };
}

// ---------- Payments tab ----------

function paymentsScreen() {
  const month = state.payMonth;
  const rows = state.members.filter(m => m.active).map(m => ({ m, plan: planFor(m), s: statusFor(m, month) }));
  const billed = rows.filter(r => r.s.due > 0);
  const owing = billed.filter(r => r.s.owes > 0).sort((a, b) => b.s.owes - a.s.owes);
  const paid = billed.filter(r => !r.s.owes).sort((a, b) => fullName(a.m).localeCompare(fullName(b.m)));
  const noPlan = rows.filter(r => !r.s.due && r.m.plan !== 'covered' && !r.s.why);
  const paused = rows.filter(r => r.s.why === 'paused');
  const collected = state.payments.filter(p => p.covers_month === month)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  const stillOwed = owing.reduce((sum, r) => sum + r.s.owes, 0);

  const row = r => `<li><a class="row" href="#/pay/${encodeURIComponent(r.m.id)}" data-act="pay-from-tab">
    <span class="avatar">${esc(initials(r.m))}</span>
    <span class="grow">
      <strong>${esc(fullName(r.m))}</strong>
      <span class="muted small wrap">${fmtMoney(r.plan.cents)}/mo · ${esc(r.plan.label)}</span>
      ${r.s.owes ? `<span class="small wrap">${esc(reminderNote(r.m, month))}</span>` : ''}
    </span>
    <span class="tag ${r.s.owes ? 'full' : 'ok'}">${r.s.owes ? fmtMoney(r.s.owes) : 'Paid'}</span>
  </a></li>`;

  return `${topBar('Payments')}
  <div class="month-bar">
    <button class="icon-btn" data-act="pay-month" data-step="-1" aria-label="Previous month">‹</button>
    <strong>${esc(fmtMonth(month))}</strong>
    <button class="icon-btn" data-act="pay-month" data-step="1" aria-label="Next month">›</button>
  </div>
  <div class="card totals">
    <div><span class="muted small">Collected</span><strong>${fmtMoney(collected)}</strong></div>
    <div><span class="muted small">Still owed</span><strong class="${stillOwed ? 'owes' : ''}">${fmtMoney(stillOwed)}</strong></div>
  </div>

  <h3 class="section">Still owe (${owing.length})</h3>
  <ul class="list">${owing.length ? owing.map(row).join('') : '<li class="empty">Everyone has paid for this month.</li>'}</ul>

  ${paid.length ? `<h3 class="section">Paid (${paid.length})</h3><ul class="list">${paid.map(row).join('')}</ul>` : ''}

  ${noPlan.length ? `<p class="muted small center">${noPlan.length === 1 ? '1 active member isn’t' : `${noPlan.length} active members aren’t`}
    in any paid classes, so nothing is due: ${esc(noPlan.map(r => fullName(r.m)).join(', '))}.</p>` : ''}
  ${paused.length ? `<p class="muted small center">⏸ Paused this month, nothing due:
    ${esc(paused.map(r => fullName(r.m)).join(', '))}.</p>` : ''}`;
}

// ---------- Pause a plan ----------

function pauseScreen(memberId) {
  const m = findMember(memberId);
  if (!m) return `${topBar('Pause plan', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  const p = currentPause(m);
  const back = `#/m/${encodeURIComponent(m.id)}`;
  return `${topBar(p ? 'Change pause' : 'Pause plan', back)}
  <p class="muted center">For <strong>${esc(fullName(m))}</strong>. Nothing is due while their plan is
    paused. Their details, classes and waiver are all kept.</p>
  <form id="pause-form" class="stack" data-member="${esc(m.id)}" data-id="${esc(p ? p.id : '')}" novalidate>
    <div class="card stack">
      <label>Pause starting<input name="start_month" type="month" value="${esc(p ? p.start_month : thisMonth())}"></label>
      <label><span>Coming back in <span class="muted small">(leave empty if not sure)</span></span>
        <input name="back_month" type="month" value="${esc(p && p.end_month ? shiftMonth(p.end_month, 1) : '')}"></label>
      <label><span>Reason <span class="muted small">(optional)</span></span>
        <input name="note" value="${esc(p ? p.note : '')}" placeholder="e.g. injury, travelling" autocomplete="off"></label>
    </div>
    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="${back}">Cancel</a>
      <button class="btn primary" type="submit">${p ? 'Save changes' : 'Pause plan'}</button>
    </div>
  </form>`;
}

async function onSavePause(form) {
  const id = form.dataset.id || null;
  const start = form.start_month.value;
  const back = form.back_month.value;
  const fields = {
    member_id: form.dataset.member,
    start_month: start,
    // They pay again from the month they're back, so the pause ends the month before.
    end_month: back ? shiftMonth(back, -1) : null,
    note: form.note.value.trim()
  };
  const problem =
    !/^\d{4}-\d{2}$/.test(start) ? 'Choose the month the pause starts.' :
    back && back <= start ? 'The month they’re back has to be after the pause starts.' : '';
  const errorEl = $('#form-error');
  if (problem) {
    errorEl.textContent = problem;
    errorEl.hidden = false;
    return;
  }
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const saved = await DB.savePause(id, fields);
    state.pauses = state.pauses.filter(p => p.id !== saved.id).concat(saved);
    toast(id ? 'Pause updated' : 'Plan paused');
    go(`#/m/${encodeURIComponent(fields.member_id)}`);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// "They're back": they pay again from this month. A pause that only started this month is
// simply removed, since no month ends up paused.
async function onResume(el) {
  const p = state.pauses.find(x => x.id === el.dataset.id);
  const m = p && findMember(p.member_id);
  if (!m || !confirm(`Mark ${fullName(m)} as back? Their plan is due again from ${fmtMonth(thisMonth())}.`)) return;
  await changePause(el, p, shiftMonth(thisMonth(), -1), `${fullName(m)} is back`);
}

// A pause that hasn't started yet can just be removed.
async function onCancelPause(el) {
  const p = state.pauses.find(x => x.id === el.dataset.id);
  if (!p || !confirm('Cancel this planned pause?')) return;
  await changePause(el, p, null, 'Pause cancelled');
}

// End a pause at endMonth, or remove it when nothing would be left paused.
async function changePause(el, p, endMonth, message) {
  el.disabled = true;
  try {
    if (!endMonth || endMonth < p.start_month) {
      await DB.deletePause(p.id);
      state.pauses = state.pauses.filter(x => x.id !== p.id);
    } else {
      const saved = await DB.savePause(p.id, { end_month: endMonth });
      state.pauses = state.pauses.map(x => (x.id === p.id ? saved : x));
    }
    toast(message);
    render();
  } catch (e) {
    toast(e.message);
    el.disabled = false;
  }
}

// ---------- Record a payment ----------

// Where to go back to after recording, and which month to suggest.
let payReturn = { hash: '', month: '' };

function payScreen(memberId) {
  const m = findMember(memberId);
  const back = payReturn.hash || `#/m/${encodeURIComponent(memberId)}`;
  if (!m) return `${topBar('Record payment', '#/payments')}<p class="empty">This member wasn’t found.</p>`;
  const month = payReturn.month || thisMonth();
  const s = statusFor(m, month);
  const plan = planFor(m);
  const suggested = s.owes || plan.cents;
  return `${topBar('Record payment', back)}
  <p class="center"><strong>${esc(fullName(m))}</strong><br>
    <span class="muted small">${esc(plan.label)}${plan.cents ? ` · ${fmtMoney(plan.cents)}/mo` : ''}</span></p>
  <form id="pay-form" class="stack" data-member="${esc(m.id)}" data-back="${esc(back)}" novalidate>
    <div class="card stack">
      <label>Amount ($) *<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal"
        value="${suggested ? (suggested / 100).toFixed(2) : ''}"></label>
      <fieldset class="methods">
        <legend>Paid by *</legend>
        ${PAY_METHODS.map(([key, label]) => `
          <label class="method"><input type="radio" name="method" value="${key}"><span>${label}</span></label>`).join('')}
      </fieldset>
      <div class="two">
        <label>For month<input name="covers_month" type="month" value="${esc(month)}"></label>
        <label>Date paid<input name="paid_on" type="date" value="${esc(todayISO())}" max="${esc(todayISO())}"></label>
      </div>
      <label><span>Note <span class="muted small">(optional)</span></span><input name="note" autocomplete="off" placeholder="e.g. paid half, rest Friday"></label>
      <p class="muted small">Don’t write card or bank numbers here.</p>
    </div>
    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="${esc(back)}">Cancel</a>
      <button class="btn primary" type="submit">Save payment</button>
    </div>
  </form>`;
}

async function onSavePayment(form) {
  const fields = {
    member_id: form.dataset.member,
    amount: Number(form.amount.value),
    method: (form.querySelector('input[name=method]:checked') || {}).value,
    covers_month: form.covers_month.value,
    paid_on: form.paid_on.value,
    note: form.note.value.trim()
  };
  const problem =
    !(fields.amount > 0) ? 'Enter the amount paid.' :
    !fields.method ? 'Choose how they paid.' :
    !/^\d{4}-\d{2}$/.test(fields.covers_month) ? 'Choose which month this payment is for.' :
    !fields.paid_on ? 'Choose the date it was paid.' :
    // A long run of digits looks like a card or bank number.
    /\d[\d -]{10,}\d/.test(fields.note) ? 'Please don’t put card or bank numbers in the note.' : '';
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
    state.payments.push(await DB.addPayment(fields));
    toast(`${fmtMoney(toCents(fields.amount))} recorded`);
    go(form.dataset.back);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, {
  payments: { html: paymentsScreen, tab: 'payments' },
  pay: { html: payScreen },
  pause: { html: pauseScreen },
  // The member form needs its plan fields shown or hidden once it's drawn.
  new: { ...SCREENS.new, after: syncPlanFields },
  edit: { ...SCREENS.edit, after: syncPlanFields }
});

Object.assign(FORMS, { 'pay-form': onSavePayment, 'pause-form': onSavePause });

Object.assign(ACTIONS, {
  'delete-payment': onDeletePayment,
  'pay-month'(el) {
    state.payMonth = shiftMonth(state.payMonth, Number(el.dataset.step));
    render();
  },
  // Remember where "Record payment" was opened from, so Save and Cancel go back there.
  'pay-from-tab'() {
    payReturn = { hash: '#/payments', month: state.payMonth };
  },
  'pay-from-member'() {
    payReturn = { hash: '', month: '' };
  },
  resume: onResume,
  'cancel-pause': onCancelPause
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'plan-select') syncPlanFields();
});
