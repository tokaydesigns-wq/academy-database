// Payments: what each member owes per month, the Payments tab (#/payments), and recording a
// payment (#/pay/MEMBER_ID). Only records money received; never card or bank details.

// What a member owes each month and why. Prices come from PRICES in core.js.
function planFor(m) {
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
  if (premium.length) {
    return { cents: PRICES.premium + PRICES.extraCourse * (premium.length - 1),
      label: premium.map(programLabel).join(' + ') + ' (Kickboxing included)' };
  }
  if (programs.has('kickboxing')) return { cents: PRICES.kickboxing, label: 'Kickboxing' };
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

// { due, paid, owes } in cents for one month.
function statusFor(m, month) {
  const due = planFor(m).cents;
  const paid = state.payments
    .filter(p => p.member_id === m.id && p.covers_month === month)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  return { due, paid, owes: Math.max(due - paid, 0) };
}

function statusText(s) {
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
  return `<div class="card">
    <dl>
      ${field('Plan', `${esc(plan.label)}${plan.cents ? ` · <strong>${fmtMoney(plan.cents)}/mo</strong>` : ''}`)}
      ${field(esc(fmtMonth(month)), `<span class="${s.owes ? 'owes' : 'paid'}">${esc(statusText(s))}</span>`)}
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
    <a class="btn small-btn" href="#/pay/${encodeURIComponent(m.id)}" data-act="pay-from-member">+ Record payment</a>
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
        ${opt('auto', 'From their classes')}
        ${opt('family', `Family plan (${fmtMoney(PRICES.family)}/mo, pays for the family)`)}
        ${opt('covered', 'On someone else’s family plan')}
        ${opt('custom', 'Custom price')}
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
    <p class="muted small" data-plan="auto">Kickboxing ${fmtMoney(PRICES.kickboxing)}. Muay Thai or Jiu Jitsu
      ${fmtMoney(PRICES.premium)} (Kickboxing included), +${fmtMoney(PRICES.extraCourse)} for each extra course.</p>
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
  const noPlan = rows.filter(r => !r.s.due && r.m.plan !== 'covered');
  const collected = state.payments.filter(p => p.covers_month === month)
    .reduce((sum, p) => sum + toCents(p.amount), 0);
  const stillOwed = owing.reduce((sum, r) => sum + r.s.owes, 0);

  const row = r => `<li><a class="row" href="#/pay/${encodeURIComponent(r.m.id)}" data-act="pay-from-tab">
    <span class="avatar">${esc(initials(r.m))}</span>
    <span class="grow">
      <strong>${esc(fullName(r.m))}</strong>
      <span class="muted small wrap">${fmtMoney(r.plan.cents)}/mo · ${esc(r.plan.label)}</span>
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
    in any paid classes, so nothing is due: ${esc(noPlan.map(r => fullName(r.m)).join(', '))}.</p>` : ''}`;
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
  // The member form needs its plan fields shown or hidden once it's drawn.
  new: { ...SCREENS.new, after: syncPlanFields },
  edit: { ...SCREENS.edit, after: syncPlanFields }
});

FORMS['pay-form'] = onSavePayment;

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
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'plan-select') syncPlanFields();
});
