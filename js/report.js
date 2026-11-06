// Money report (#/report, from the Payments tab): what came in for a month, split by how it
// was paid and by plan, compared with last month, plus a six-month trend, what's still unpaid
// and who joined or left. "Came in" counts payments by the date they were paid, so it matches
// the money in the till; the Payments tab counts by the month a payment is for.

// Short plan names for the "By plan" split. Kids on a family plan count with the family.
const REPORT_PLANS = {
  kickboxing: 'Kickboxing only', muay_thai: 'Muay Thai', jiu_jitsu: 'Jiu Jitsu', all: 'All 3',
  family: 'Family plan', covered: 'Family plan', custom: 'Custom price', auto: 'Priced from classes'
};

// Payments received during a month ("2026-11"), by the date they were paid.
function paidDuring(month) {
  return state.payments.filter(p => (p.paid_on || '').slice(0, 7) === month);
}

function sumCents(list) {
  return list.reduce((sum, p) => sum + toCents(p.amount), 0);
}

// Totals per group, biggest first: [{ label, cents }].
function groupTotals(payments, labelOf) {
  const totals = new Map();
  payments.forEach(p => {
    const label = labelOf(p);
    totals.set(label, (totals.get(label) || 0) + toCents(p.amount));
  });
  return [...totals].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
}

function planGroup(p) {
  const m = findMember(p.member_id);
  return m ? REPORT_PLANS[m.plan] || 'Other' : 'Removed members';
}

// "+$120 (12%) vs October", against the month before. While a month is still going, it's
// compared with the same days of last month ("vs October 1–6"), so it isn't always behind.
function changeLine(month) {
  const prevMonth = shiftMonth(month, -1);
  const now = sumCents(paidDuring(month));
  let before = paidDuring(prevMonth);
  let name = fmtMonth(prevMonth).split(' ')[0];
  if (month === thisMonth()) {
    const today = new Date().getDate();
    before = before.filter(p => Number(p.paid_on.slice(8, 10)) <= today);
    name += today === 1 ? ' 1' : ` 1–${today}`;
  }
  before = sumCents(before);
  if (!before) return now ? `Nothing came in during ${name}` : '';
  const diff = now - before;
  if (!diff) return `Same as ${name}`;
  const pct = Math.round(Math.abs(diff) / before * 100);
  return `${diff > 0 ? '▲ +' : '▼ −'}${fmtMoney(Math.abs(diff))} (${pct}%) vs ${name}`;
}

// Horizontal bars, one row per group, each labelled with its amount.
function barRows(groups) {
  const max = Math.max(...groups.map(g => g.cents), 1);
  return `<ul class="plain bar-rows">${groups.map(g => `
    <li>
      <span class="bar-label">${esc(g.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(g.cents / max * 100, 2).toFixed(1)}%"></span></span>
      <strong class="bar-value">${fmtMoney(g.cents)}</strong>
    </li>`).join('')}</ul>`;
}

// The six months ending with this one, as columns. The month being looked at is darker.
function trendChart(month) {
  const months = [5, 4, 3, 2, 1, 0].map(n => shiftMonth(month, -n));
  const totals = months.map(mo => sumCents(paidDuring(mo)));
  const max = Math.max(...totals, 1);
  const short = mo => fmtMonth(mo).slice(0, 3);
  return `<div class="trend" role="img" aria-label="Money in over the last six months: ${
    esc(months.map((mo, i) => `${fmtMonth(mo)} ${fmtMoney(totals[i])}`).join(', '))}">
    ${months.map((mo, i) => `
      <div class="trend-col ${mo === month ? 'on' : ''}">
        <span class="trend-value">${totals[i] ? '$' + Math.round(totals[i] / 100).toLocaleString('en-US') : ''}</span>
        <span class="trend-bar" style="height:${(totals[i] / max * 100).toFixed(1)}%"></span>
        <span class="trend-month">${esc(short(mo))}</span>
      </div>`).join('')}
  </div>`;
}

function reportScreen() {
  const month = state.payMonth;
  const came = paidDuring(month);
  const total = sumCents(came);
  const change = changeLine(month);
  const soFar = month === thisMonth() ? ' so far' : '';

  const unpaid = state.members.filter(m => m.active).map(m => statusFor(m, month).owes).filter(Boolean);
  const unpaidTotal = unpaid.reduce((a, b) => a + b, 0);
  const joined = state.members.filter(m => joinedMonth(m) === month).length;
  const left = state.members.filter(m => leftMonth(m) === month).length;
  const people = n => (n === 1 ? '1 person' : `${n} people`);

  return `${topBar('Money report', '#/payments')}
  <div class="month-bar">
    <button class="icon-btn" data-act="pay-month" data-step="-1" aria-label="Previous month">‹</button>
    <strong>${esc(fmtMonth(month))}</strong>
    <button class="icon-btn" data-act="pay-month" data-step="1" aria-label="Next month">›</button>
  </div>

  <div class="card report-hero">
    <span class="muted small">Money in${soFar}</span>
    <strong>${fmtMoney(total)}</strong>
    <span class="small">${came.length === 1 ? '1 payment' : `${came.length} payments`}${change ? ` · ${esc(change)}` : ''}</span>
  </div>

  ${came.length ? `
    <h3 class="section">How it was paid</h3>
    <div class="card">${barRows(groupTotals(came, p => methodLabel(p.method)))}</div>
    <h3 class="section">By plan</h3>
    <div class="card">${barRows(groupTotals(came, planGroup))}</div>` : ''}

  <h3 class="section">Last six months</h3>
  <div class="card">${trendChart(month)}</div>

  <h3 class="section">Still unpaid for ${esc(fmtMonth(month).split(' ')[0])}</h3>
  <a class="card row-card" href="#/payments">
    <span class="grow">${unpaid.length
      ? `<strong class="owes">${fmtMoney(unpaidTotal)}</strong> <span class="muted small">from ${people(unpaid.length)}</span>`
      : '<strong class="paid">Nothing unpaid</strong>'}</span>
    <span class="muted">See who ›</span>
  </a>

  <h3 class="section">Members</h3>
  <div class="card totals">
    <div><span class="muted small">Joined</span><strong>${joined}</strong></div>
    <div><span class="muted small">Left</span><strong>${left}</strong></div>
  </div>
  <p class="muted small center">Money in counts payments by the date they were paid. The Payments
    tab counts them by the month they’re for, so the two can differ a little.</p>`;
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, { report: { html: reportScreen, tab: 'payments' } });
