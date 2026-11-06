// Front desk mode: the gym's tablet (Android), signed in by staff, where members fill in their own details
// and sign the waiver. While it's on, only these screens can be shown (see render() in ui.js):
// #/kiosk (welcome), #/kiosk-form, #/kiosk-done, #/kiosk-exit (staff password to leave).
// Members never see anyone else's details. Existing members are matched by name plus date of
// birth or phone, and only their blank details are filled in.

const KIOSK_KEY = 'academy.frontDesk';
const KIOSK_SCREENS = ['kiosk', 'kiosk-form', 'kiosk-done', 'kiosk-exit'];
const KIOSK_IDLE_MS = 3 * 60 * 1000;   // clear a half-filled form after 3 minutes untouched

// Stored on this device only, so a reload stays in front desk mode.
function kioskOn() {
  try { return localStorage.getItem(KIOSK_KEY) === '1'; } catch (e) { return false; }
}

function setKiosk(on) {
  try {
    if (on) localStorage.setItem(KIOSK_KEY, '1'); else localStorage.removeItem(KIOSK_KEY);
  } catch (e) { /* can't remember it; front desk mode lasts until reload */ }
}

// Program choices; these English labels go in staff notes. The form shows t('programs').
const KIOSK_PROGRAMS = [
  ['kickboxing', 'Kickboxing'], ['muay_thai', 'Muay Thai'], ['jiu_jitsu', 'Jiu Jitsu'],
  ['all', 'All 3'], ['', 'Not sure yet']
];

// ---------- On the account (☰) screen ----------

function frontDeskCard() {
  return `<h3 class="section">Front desk tablet</h3>
  <div class="card stack">
    <p class="small">Turns this device into a sign-up station. Members fill in their own details,
      choose a program and sign the waiver. They can’t see anyone else’s details.</p>
    <p class="muted small">To leave front desk mode you’ll need this account’s password.
      Also pin the app on the tablet so members can’t switch apps: turn on App pinning in Android
      Settings (search “pin”), then pin this app from the Recent apps screen.</p>
    <button class="btn primary" data-act="kiosk-start">Start front desk mode</button>
  </div>`;
}

// ---------- Welcome ----------

function kioskScreen() {
  kioskLang = 'en';
  kioskFamilyNames = '';
  return `<section class="kiosk-welcome">
    <div class="logo">AD</div>
    <h1>${KIOSK_TEXT.en.welcomeTitle}</h1>
    <p>${KIOSK_TEXT.en.welcomeText}</p>
    <p lang="es">${KIOSK_TEXT.es.welcomeText}</p>
    <div class="lang-columns">
      <div class="stack">
        <strong>English</strong>
        <a class="btn primary big" href="#/kiosk-form" data-act="kiosk-lang" data-lang="en">${KIOSK_TEXT.en.justMe}</a>
        <a class="btn big" href="#/kiosk-family" data-act="kiosk-lang" data-lang="en">${KIOSK_TEXT.en.myFamily}</a>
      </div>
      <div class="stack" lang="es">
        <strong>Español</strong>
        <a class="btn primary big" href="#/kiosk-form" data-act="kiosk-lang" data-lang="es">${KIOSK_TEXT.es.justMe}</a>
        <a class="btn big" href="#/kiosk-family" data-act="kiosk-lang" data-lang="es">${KIOSK_TEXT.es.myFamily}</a>
      </div>
    </div>
  </section>
  <p class="center kiosk-staff"><a class="link-btn" href="#/kiosk-exit">Staff</a></p>`;
}

// ---------- The form ----------

function kioskFormScreen() {
  const blank = {};
  const req = text => `<span>${text} <span data-minor="minor">*</span></span>`;
  // In Spanish, the reference translation comes first, then the official English waiver.
  const waiverCards = kioskLang === 'es'
    ? `<div class="card waiver-text" lang="es"><p class="ref-note">${t('refNote')}</p>${waiverTextHtml(waiverTextEs())}</div>
      <p class="small">${t('officialEnglish')}</p>
      <div class="card waiver-text" lang="en">${waiverTextHtml(waiverText())}</div>`
    : `<div class="card waiver-text">${waiverTextHtml(waiverText())}</div>`;
  const today = new Date().toLocaleDateString(kioskLang === 'es' ? 'es-US' : undefined,
    { day: 'numeric', month: 'short', year: 'numeric' });
  return `<header class="top">
    <a class="icon-btn" href="#/kiosk" aria-label="${t('cancel')}">‹</a>
    <h1>${t('yourDetails')}</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>
  <form id="kiosk-form" class="stack" novalidate autocomplete="off" lang="${kioskLang}">
    <h3 class="section">${t('aboutYou')}</h3>
    <div class="card stack">
      <div class="two">
        ${input('first_name', t('firstName'), blank)}
        ${input('last_name', t('lastName'), blank)}
      </div>
      <div class="two">
        ${input('date_of_birth', t('dob'), blank, 'date', `max="${todayISO()}"`)}
        <label>${t('sex')}<select name="sex">
          <option value="">–</option><option value="male">${t('male')}</option><option value="female">${t('female')}</option>
        </select></label>
      </div>
      <p class="muted small">${t('dobHint')}</p>
    </div>

    <h3 class="section">${t('contact')}</h3>
    <div class="card stack">
      <div class="two">
        ${input('phone', t('phoneReq'), blank, 'tel')}
        ${input('alt_phone', t('altPhone'), blank, 'tel')}
      </div>
      ${input('email', t('email'), blank, 'email')}
      ${input('address', t('street'), blank)}
      <div class="city-row">
        ${input('city', t('city'), blank)}
        ${input('state', t('state'), blank, 'text', 'maxlength="20"')}
        ${input('zip', t('zip'), blank, 'text', 'inputmode="numeric" maxlength="10"')}
      </div>
    </div>

    <h3 class="section">${t('medical')}</h3>
    <div class="card stack">
      <label><span>${t('medicalLabel')} <span class="muted small">${t('medicalHint')}</span></span>
        <textarea name="medical" rows="2"></textarea></label>
    </div>

    <h3 class="section">${t('emergency')}</h3>
    <div class="card stack">
      <div class="two">
        ${input('emergency_name', t('nameReq'), blank)}
        ${input('emergency_relation', t('relation'), blank, 'text', `placeholder="${t('relationPh')}"`)}
      </div>
      <div class="two">
        ${input('emergency_phone', t('phoneReq'), blank, 'tel')}
        ${input('emergency_alt_phone', t('altPhone'), blank, 'tel')}
      </div>
    </div>

    <div class="stack minor-only" data-minor="minor">
    <h3 class="section">${t('parentSection')}</h3>
    <div class="card stack guardian-card required" id="guardian-card">
      <p class="small" id="minor-status">${t('minorNoteYes')}</p>
      <div class="two">
        ${input('guardian_name', req(t('parentName')), blank)}
        ${input('guardian_relation', t('relationship'), blank, 'text', `placeholder="${t('relationshipPh')}"`)}
      </div>
      <div class="two">
        ${input('guardian_phone', req(t('phone')), blank, 'tel')}
        ${input('guardian_email', t('email'), blank, 'email')}
      </div>
    </div>
    </div>

    <h3 class="section">${t('train')}</h3>
    <div class="card stack">
      <fieldset class="methods programs">
        <legend class="muted small">${t('trainNote')}</legend>
        ${KIOSK_PROGRAMS.map(([key]) => `
          <label class="method"><input type="radio" name="program" value="${key}"><span>${t('programs')[key]}</span></label>`).join('')}
      </fieldset>
    </div>

    <h3 class="section">${t('waiver')}</h3>
    ${waiverCards}
    <div class="card stack">
      <input type="checkbox" id="minor-check" name="minor" hidden>
      <div>
        <div class="pad-label"><strong>${t('yourSig')} <span data-minor="adult">*</span><span data-minor="minor" class="muted small">${t('optional')}</span></strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-participant">${t('clear')}</button></div>
        <canvas class="sig-pad" id="pad-participant" aria-label="${t('sigAria')}"></canvas>
      </div>
      <div data-minor="minor">
        <div class="pad-label"><strong>${t('parentSig')} *</strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-guardian">${t('clear')}</button></div>
        <canvas class="sig-pad" id="pad-guardian" aria-label="${t('parentSigAria')}"></canvas>
      </div>
      <p class="small">${t('date')}: <strong>${esc(today)}</strong></p>
      <label class="check"><input type="checkbox" name="agree"> ${t('agree')}</label>
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="#/kiosk">${t('cancel')}</a>
      <button class="btn primary big" type="submit">${t('finish')}</button>
    </div>
  </form>`;
}

// Under 18 is worked out from the date of birth they type.
function syncKioskAge() {
  const dob = document.querySelector('#kiosk-form [name=date_of_birth]')?.value;
  const box = $('#minor-check');
  if (!box) return;
  const age = ageFrom(dob);
  box.checked = age !== null && age < 18;
  syncMinor();   // shows the parent section and signature for under-18s, hides them otherwise
}

const digitsOf = s => String(s || '').replace(/\D/g, '');

// An existing member with the same name and the same date of birth or phone number.
function findExisting(f) {
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  return state.members.find(m => same(m.first_name, f.first_name) && same(m.last_name, f.last_name) &&
    ((f.date_of_birth && m.date_of_birth === f.date_of_birth) ||
     (digitsOf(f.phone).length >= 7 && digitsOf(m.phone) === digitsOf(f.phone))));
}

let kioskFirstName = '';   // for the thank-you screen only
let kioskFamilyNames = '';  // the kids' first names after a family sign-up

async function onKioskSubmit(form) {
  const f = {};
  for (const name of MEMBER_FIELDS) {
    if (name === 'active' || name === 'notes') continue;
    f[name] = (form[name].value || '').trim();
  }
  const program = (form.querySelector('input[name=program]:checked') || {}).value;
  const minor = $('#minor-check').checked;
  if (!minor) {
    // Parent details only belong with under-18s.
    for (const k of ['guardian_name', 'guardian_relation', 'guardian_phone', 'guardian_email']) f[k] = '';
  }
  const signature = padImage($('#pad-participant'));
  const guardianName = f.guardian_name;
  const guardianSignature = minor ? padImage($('#pad-guardian')) : null;

  const problem =
    !f.first_name || !f.last_name ? t('eName') :
    !f.date_of_birth ? t('eDob') :
    new Date(f.date_of_birth) > new Date() ? t('eDobFuture') :
    digitsOf(f.phone).length < 7 ? t('ePhone') :
    f.email && !looksLikeEmail(f.email) ? t('eEmail') :
    !f.emergency_name || digitsOf(f.emergency_phone).length < 7 ? t('eEmergency') :
    program === undefined ? t('eProgram') :
    !minor && !signature ? t('eSign') :
    minor && !guardianName ? t('eParentName') :
    minor && digitsOf(f.guardian_phone).length < 7 ? t('eParentPhone') :
    minor && f.guardian_email && !looksLikeEmail(f.guardian_email) ? t('eParentEmail') :
    minor && !guardianSignature ? t('eParentSign') :
    !form.agree.checked ? t('eAgree') : '';
  const errorEl = $('#form-error');
  if (problem) {
    errorEl.textContent = problem;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.textContent = t('saving');
  // Staff notes stay in English, and say when the Spanish form was used.
  const wants = KIOSK_PROGRAMS.find(([key]) => key === program)[1] + (kioskLang === 'es' ? ' (filled in in Spanish)' : '');
  let member;
  try {
    // Fetch the latest members first, so someone staff added recently is matched, not duplicated.
    await loadAll();
    const existing = findExisting(f);
    if (existing) {
      // Only fill in what's blank. Nothing already saved is changed or shown.
      const updates = {};
      for (const [key, value] of Object.entries(f)) {
        if (value && !existing[key]) updates[key] = value;
      }
      const note = `Updated their details at the front desk on ${fmtDate(todayISO())}. Wants: ${wants}.`;
      updates.review_note = existing.review_note ? `${existing.review_note} ${note}` : note;
      member = await DB.saveMember(existing.id, updates);
    } else {
      member = await DB.saveMember(null, {
        ...f, date_of_birth: f.date_of_birth || null, sex: f.sex || null, notes: '', active: true,
        plan: program || 'auto', custom_price: null, paid_by: null,
        review_note: `Signed up at the front desk on ${fmtDate(todayISO())}. Wants: ${wants}.`
      });
    }
  } catch (e) {
    errorEl.textContent = t('eSave', { msg: e.message });
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = t('finish');
    return;
  }

  try {
    await DB.addWaiver({
      member_id: member.id, kind: 'signed', version: WAIVER.version, waiver_text: signedWaiverText(),
      signed_name: `${f.first_name} ${f.last_name}`, signature,
      guardian_name: guardianName, guardian_signature: guardianSignature, signed_on: todayISO()
    });
  } catch (e) {
    errorEl.textContent = t('eWaiver');
    errorEl.hidden = false;
    button.textContent = t('finish');
    return;
  }

  kioskFirstName = f.first_name;
  await loadAll().catch(() => {});   // so the next match sees this person too
  form.reset();   // nothing left on screen for the next person
  go('#/kiosk-done');
}

// ---------- Thank you ----------

let doneTimer;

function kioskDoneScreen() {
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => { if (route().name === 'kiosk-done') go('#/kiosk'); }, 10000);
  return `<section class="kiosk-welcome">
    <div class="done-check">✓</div>
    <h1>${t('doneTitle', { name: kioskFirstName ? `, ${esc(kioskFirstName)}` : '' })}</h1>
    ${kioskFamilyNames ? `<p><strong>${esc(t('doneFamily', { names: kioskFamilyNames }))}</strong></p>` : ''}
    <p>${t('doneText')}</p>
    <a class="btn big" href="#/kiosk">${t('done')}</a>
  </section>`;
}

// ---------- Leaving front desk mode ----------

function kioskExitScreen() {
  return `<header class="top">
    <a class="icon-btn" href="#/kiosk" aria-label="Back">‹</a>
    <h1>Staff only</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>
  <form id="kiosk-exit-form" class="card stack" novalidate>
    <p class="small">Enter the password for <strong>${esc(state.user.email)}</strong> to leave front desk mode.</p>
    <label>Password<input name="password" type="password" autocomplete="current-password"></label>
    <p id="form-error" class="error" hidden></p>
    <button class="btn primary" type="submit">Leave front desk mode</button>
  </form>`;
}

async function onKioskExit(form) {
  const errorEl = $('#form-error');
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    await DB.checkPassword(form.password.value);
    setKiosk(false);
    await loadAll();   // pick up everyone who signed up while it was on
    toast('Front desk mode is off');
    go('#/members');
  } catch (e) {
    form.password.value = '';
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// ---------- Clearing a form someone walked away from ----------

let kioskLastTouch = Date.now();
['pointerdown', 'keydown', 'input'].forEach(t =>
  document.addEventListener(t, () => { kioskLastTouch = Date.now(); }, true));

setInterval(() => {
  const name = route().name;
  if (kioskOn() && ['kiosk-form', 'kiosk-family', 'kiosk-exit'].includes(name) &&
      Date.now() - kioskLastTouch > KIOSK_IDLE_MS) {
    const message = t('idle');
    go('#/kiosk');   // the welcome screen resets the language to English
    toast(message);
  }
}, 15000);

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, {
  kiosk: { html: kioskScreen },
  'kiosk-form': { html: kioskFormScreen, after: syncKioskAge },
  'kiosk-done': { html: kioskDoneScreen },
  'kiosk-exit': { html: kioskExitScreen }
});

Object.assign(FORMS, { 'kiosk-form': onKioskSubmit, 'kiosk-exit-form': onKioskExit });

Object.assign(ACTIONS, {
  'kiosk-start'() {
    setKiosk(true);
    go('#/kiosk');
  },
  // The welcome screen's English / Español buttons (the link itself opens the form).
  'kiosk-lang'(el) {
    kioskLang = el.dataset.lang === 'es' ? 'es' : 'en';
  },
  async 'review-done'(el) {
    el.disabled = true;
    try {
      const saved = await DB.saveMember(el.dataset.id, { review_note: '' });
      state.members = state.members.map(m => (m.id === saved.id ? saved : m));
      toast('Marked as checked');
      render();
    } catch (e) {
      toast(e.message);
      el.disabled = false;
    }
  }
});

['change', 'input'].forEach(type => document.addEventListener(type, (e) => {
  if (e.target.name === 'date_of_birth' && e.target.closest('#kiosk-form')) syncKioskAge();
}));
