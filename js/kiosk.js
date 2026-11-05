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
  return `<section class="kiosk-welcome">
    <div class="logo">AD</div>
    <h1>Welcome to Academy Martial Arts</h1>
    <p>New here, or need to update your details? Fill in the form and sign the waiver.
      It takes about 3 minutes.</p>
    <a class="btn primary big" href="#/kiosk-form">Start</a>
  </section>
  <p class="center kiosk-staff"><a class="link-btn" href="#/kiosk-exit">Staff</a></p>`;
}

// ---------- The form ----------

function kioskFormScreen() {
  const blank = {};
  return `<header class="top">
    <a class="icon-btn" href="#/kiosk" aria-label="Cancel">‹</a>
    <h1>Your details</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>
  <form id="kiosk-form" class="stack" novalidate autocomplete="off">
    <h3 class="section">About you</h3>
    <div class="card stack">
      <div class="two">
        ${input('first_name', 'First name *', blank)}
        ${input('last_name', 'Last name *', blank)}
      </div>
      <div class="two">
        ${input('date_of_birth', 'Date of birth *', blank, 'date', `max="${todayISO()}"`)}
        <label>Sex<select name="sex">
          <option value="">–</option><option value="male">Male</option><option value="female">Female</option>
        </select></label>
      </div>
    </div>

    <h3 class="section">Contact</h3>
    <div class="card stack">
      <div class="two">
        ${input('phone', 'Phone *', blank, 'tel')}
        ${input('alt_phone', 'Alt phone', blank, 'tel')}
      </div>
      ${input('email', 'Email', blank, 'email')}
      ${input('address', 'Street address', blank)}
      <div class="city-row">
        ${input('city', 'City', blank)}
        ${input('state', 'State', blank, 'text', 'maxlength="20"')}
        ${input('zip', 'Zip', blank, 'text', 'inputmode="numeric" maxlength="10"')}
      </div>
    </div>

    <h3 class="section">Medical conditions</h3>
    <div class="card stack">
      <label><span>Anything your coach should know <span class="muted small">(or “none”)</span></span>
        <textarea name="medical" rows="2"></textarea></label>
    </div>

    <h3 class="section">Emergency contact</h3>
    <div class="card stack">
      <div class="two">
        ${input('emergency_name', 'Name *', blank)}
        ${input('emergency_relation', 'Relation', blank, 'text', 'placeholder="e.g. Mom"')}
      </div>
      <div class="two">
        ${input('emergency_phone', 'Phone *', blank, 'tel')}
        ${input('emergency_alt_phone', 'Alt phone', blank, 'tel')}
      </div>
    </div>

    <h3 class="section">Parent or guardian <span class="muted">(if under 18)</span></h3>
    <div class="card stack guardian-card" id="guardian-card">
      <p class="small" id="minor-status">If you’re under 18, a parent or guardian needs to fill this in and sign
        the waiver below.</p>
      <div class="two">
        ${input('guardian_name', '<span>Parent/guardian name <span data-minor="minor">*</span></span>', blank)}
        ${input('guardian_relation', 'Relationship', blank, 'text', 'placeholder="e.g. Mom, Dad"')}
      </div>
      <div class="two">
        ${input('guardian_phone', '<span>Phone <span data-minor="minor">*</span></span>', blank, 'tel')}
        ${input('guardian_email', 'Email', blank, 'email')}
      </div>
    </div>

    <h3 class="section">What would you like to train?</h3>
    <div class="card stack">
      <fieldset class="methods programs">
        <legend class="muted small">Kickboxing is included with Muay Thai and Jiu Jitsu. The front desk will confirm the price.</legend>
        ${KIOSK_PROGRAMS.map(([key, label]) => `
          <label class="method"><input type="radio" name="program" value="${key}"><span>${label}</span></label>`).join('')}
      </fieldset>
    </div>

    <h3 class="section">Waiver</h3>
    <div class="card waiver-text">${waiverTextHtml(waiverText())}</div>
    <div class="card stack">
      <input type="checkbox" id="minor-check" name="minor" hidden>
      <div>
        <div class="pad-label"><strong>Your signature <span data-minor="adult">*</span><span data-minor="minor" class="muted small">(optional)</span></strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-participant">Clear</button></div>
        <canvas class="sig-pad" id="pad-participant" aria-label="Your signature: sign with your finger"></canvas>
      </div>
      <div>
        <div class="pad-label"><strong>Parent/guardian signature <span data-minor="minor">*</span><span data-minor="adult"
          class="muted small">(if under 18)</span></strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-guardian">Clear</button></div>
        <canvas class="sig-pad" id="pad-guardian" aria-label="Parent or guardian signature: sign with your finger"></canvas>
      </div>
      <p class="small">Date: <strong>${esc(fmtDate(todayISO()))}</strong></p>
      <label class="check"><input type="checkbox" name="agree"> I have read this waiver and agree to it.</label>
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="#/kiosk">Cancel</a>
      <button class="btn primary big" type="submit">Finish</button>
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
  const status = $('#minor-status');
  status.innerHTML = box.checked
    ? `<strong>You’re under 18</strong>, so a parent or guardian needs to fill this in and sign the waiver below.`
    : `If you’re under 18, a parent or guardian needs to fill this in and sign the waiver below.`;
  $('#guardian-card').classList.toggle('required', box.checked);
  syncMinor();
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
    !f.first_name || !f.last_name ? 'Please add your first and last name.' :
    !f.date_of_birth ? 'Please add your date of birth.' :
    new Date(f.date_of_birth) > new Date() ? 'Your date of birth is in the future.' :
    digitsOf(f.phone).length < 7 ? 'Please add a phone number.' :
    f.email && !looksLikeEmail(f.email) ? 'That email doesn’t look right.' :
    !f.emergency_name || digitsOf(f.emergency_phone).length < 7 ? 'Please add an emergency contact name and phone.' :
    program === undefined ? 'Please choose what you’d like to train (or “Not sure yet”).' :
    !minor && !signature ? 'Please sign the waiver in the box.' :
    minor && !guardianName ? 'You’re under 18: please add your parent or guardian’s name.' :
    minor && digitsOf(f.guardian_phone).length < 7 ? 'Please add your parent or guardian’s phone number.' :
    minor && f.guardian_email && !looksLikeEmail(f.guardian_email) ? 'The parent or guardian’s email doesn’t look right.' :
    minor && !guardianSignature ? 'A parent or guardian needs to sign the waiver in the box.' :
    !form.agree.checked ? 'Please tick the box to agree to the waiver.' : '';
  const errorEl = $('#form-error');
  if (problem) {
    errorEl.textContent = problem;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.textContent = 'Saving…';
  const wants = KIOSK_PROGRAMS.find(([key]) => key === program)[1];
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
    errorEl.textContent = `Sorry, that didn’t save (${e.message}). Please ask the front desk for help.`;
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = 'Finish';
    return;
  }

  try {
    await DB.addWaiver({
      member_id: member.id, kind: 'signed', version: WAIVER.version, waiver_text: waiverText(),
      signed_name: `${f.first_name} ${f.last_name}`, signature,
      guardian_name: guardianName, guardian_signature: guardianSignature, signed_on: todayISO()
    });
  } catch (e) {
    errorEl.textContent = 'Your details were saved, but the waiver wasn’t. Please ask the front desk to help you sign it.';
    errorEl.hidden = false;
    button.textContent = 'Finish';
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
    <h1>All done${kioskFirstName ? `, ${esc(kioskFirstName)}` : ''}!</h1>
    <p>Thanks. Your details and waiver are saved. Please hand the tablet back to the front desk.</p>
    <a class="btn big" href="#/kiosk">Done</a>
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
  if (kioskOn() && (name === 'kiosk-form' || name === 'kiosk-exit') &&
      Date.now() - kioskLastTouch > KIOSK_IDLE_MS) {
    go('#/kiosk');
    toast('The form was cleared because no one was using it.');
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

document.addEventListener('change', (e) => {
  if (e.target.name === 'date_of_birth' && e.target.closest('#kiosk-form')) syncKioskAge();
});
