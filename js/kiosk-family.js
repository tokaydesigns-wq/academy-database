// Family sign-up on the front desk tablet (#/kiosk-family): one parent or guardian fills in their
// details, adds each child under 18, picks a family plan or separate plans, and signs the waiver
// once for everyone. Each child becomes their own member with their own signed waiver; the
// parent is only added as a member if they tick "I'm training too". Existing members are matched
// the same way as the single form (findExisting in kiosk.js) and only their blanks are filled.

const FAMILY_MAX_CHILDREN = 8;

function familyScreen() {
  const blank = {};
  const waiverCards = kioskLang === 'es'
    ? `<div class="card waiver-text" lang="es"><p class="ref-note">${t('refNote')}</p>${waiverTextHtml(waiverTextEs())}</div>
      <p class="small">${t('officialEnglish')}</p>
      <div class="card waiver-text" lang="en">${waiverTextHtml(waiverText())}</div>`
    : `<div class="card waiver-text">${waiverTextHtml(waiverText())}</div>`;
  const today = new Date().toLocaleDateString(kioskLang === 'es' ? 'es-US' : undefined,
    { day: 'numeric', month: 'short', year: 'numeric' });
  return `<header class="top">
    <a class="icon-btn" href="#/kiosk" aria-label="${t('cancel')}">‹</a>
    <h1>${t('familyTitle')}</h1>
    <span class="icon-btn" aria-hidden="true"></span>
  </header>
  <p class="muted center">${t('familyIntro')}</p>
  <form id="family-form" class="stack" novalidate autocomplete="off" lang="${kioskLang}">
    <h3 class="section">${t('parentYou')}</h3>
    <div class="card stack">
      <div class="two">
        ${input('p_first_name', t('firstName'), blank)}
        ${input('p_last_name', t('lastName'), blank)}
      </div>
      <div class="two">
        ${input('p_date_of_birth', t('dob'), blank, 'date', `max="${todayISO()}"`)}
        ${input('p_relation', t('relationToKids'), blank, 'text', `placeholder="${t('relationToKidsPh')}"`)}
      </div>
      <div class="two">
        ${input('p_phone', t('phoneReq'), blank, 'tel')}
        ${input('p_alt_phone', t('altPhone'), blank, 'tel')}
      </div>
      ${input('p_email', t('email'), blank, 'email')}
      ${input('p_address', t('street'), blank)}
      <div class="city-row">
        ${input('p_city', t('city'), blank)}
        ${input('p_state', t('state'), blank, 'text', 'maxlength="20"')}
        ${input('p_zip', t('zip'), blank, 'text', 'inputmode="numeric" maxlength="10"')}
      </div>
      <label class="check"><input type="checkbox" name="p_training" id="p-training"> ${t('trainingToo')}</label>
      <div class="stack" id="p-training-part" hidden>
        <label><span>${t('yourMedical')} <span class="muted small">${t('medicalHint')}</span></span>
          <textarea name="p_medical" rows="2"></textarea></label>
        <fieldset class="methods programs">
          <legend class="muted small">${t('train')}</legend>
          ${programChoices('p_program')}
        </fieldset>
      </div>
    </div>

    <h3 class="section">${t('familyEmergency')}</h3>
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

    <h3 class="section">${t('children')}</h3>
    <div id="children" class="stack">${childBlock(1)}</div>
    <button type="button" class="btn" data-act="family-add-child" id="add-child">${t('addChild')}</button>

    <h3 class="section">${t('planTitle')}</h3>
    <div class="card stack">
      <label class="check"><input type="radio" name="family_plan" value="family"> ${t('planFamily')}</label>
      <label class="check"><input type="radio" name="family_plan" value="separate"> ${t('planSeparate')}</label>
      <p class="muted small">${t('planNote')}</p>
    </div>

    <h3 class="section">${t('waiver')}</h3>
    ${waiverCards}
    <div class="card stack">
      <div>
        <div class="pad-label"><strong>${t('familySig')}</strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-family">${t('clear')}</button></div>
        <canvas class="sig-pad" id="pad-family" aria-label="${t('parentSigAria')}"></canvas>
      </div>
      <p class="small">${t('date')}: <strong>${esc(today)}</strong></p>
      <label class="check"><input type="checkbox" name="agree"> ${t('agreeFamily')}</label>
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="#/kiosk">${t('cancel')}</a>
      <button class="btn primary big" type="submit">${t('finish')}</button>
    </div>
  </form>`;
}

function programChoices(name) {
  return KIOSK_PROGRAMS.map(([key]) => `
    <label class="method"><input type="radio" name="${name}" value="${key}"><span>${t('programs')[key]}</span></label>`).join('');
}

// One child's card. n is only used for unique field names; the visible number is set by
// renumberChildren() so removing a child never leaves a gap.
function childBlock(n) {
  const blank = {};
  return `<div class="card stack child-block" data-child="${n}">
    <div class="child-head">
      <strong class="child-title">${t('child', { n })}</strong>
      ${n > 1 ? `<button type="button" class="link-btn" data-act="family-remove-child">${t('removeChild')}</button>` : ''}
    </div>
    <div class="two">
      ${input(`c${n}_first_name`, t('firstName'), blank)}
      ${input(`c${n}_last_name`, t('lastName'), blank)}
    </div>
    <div class="two">
      ${input(`c${n}_date_of_birth`, t('dob'), blank, 'date', `max="${todayISO()}"`)}
      <label>${t('sex')}<select name="c${n}_sex">
        <option value="">–</option><option value="male">${t('male')}</option><option value="female">${t('female')}</option>
      </select></label>
    </div>
    <label><span>${t('childMedical')} <span class="muted small">${t('medicalHint')}</span></span>
      <textarea name="c${n}_medical" rows="2"></textarea></label>
    <fieldset class="methods programs">
      <legend class="muted small">${t('childTrain')}</legend>
      ${programChoices(`c${n}_program`)}
    </fieldset>
  </div>`;
}

let familyNextChild = 2;

function afterFamily() {
  familyNextChild = 2;
  setupPad($('#pad-family'));
}

function renumberChildren() {
  document.querySelectorAll('.child-block .child-title').forEach((el, i) => {
    el.textContent = t('child', { n: i + 1 });
  });
  $('#add-child').hidden = document.querySelectorAll('.child-block').length >= FAMILY_MAX_CHILDREN;
}

function onAddChild() {
  const n = familyNextChild++;
  $('#children').insertAdjacentHTML('beforeend', childBlock(n));
  // Most kids share the parent's last name, so start with it.
  const last = $('#family-form').p_last_name.value.trim();
  if (last) document.querySelector(`[name=c${n}_last_name]`).value = last;
  renumberChildren();
  document.querySelector(`[name=c${n}_first_name]`).focus();
}

function onRemoveChild(el) {
  el.closest('.child-block').remove();
  renumberChildren();
}

// ---------- Saving ----------

async function onFamilySubmit(form) {
  const val = name => (form.querySelector(`[name="${name}"]`)?.value || '').trim();
  const checked = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const parent = {
    first_name: val('p_first_name'), last_name: val('p_last_name'), date_of_birth: val('p_date_of_birth'),
    phone: val('p_phone'), alt_phone: val('p_alt_phone'), email: val('p_email'),
    address: val('p_address'), city: val('p_city'), state: val('p_state'), zip: val('p_zip'),
    medical: val('p_medical'), relation: val('p_relation')
  };
  const training = form.p_training.checked;
  const parentProgram = checked('p_program');
  const emergency = {
    emergency_name: val('emergency_name'), emergency_relation: val('emergency_relation'),
    emergency_phone: val('emergency_phone'), emergency_alt_phone: val('emergency_alt_phone')
  };
  const children = [...form.querySelectorAll('.child-block')].map(block => {
    const n = block.dataset.child;
    return {
      first_name: val(`c${n}_first_name`), last_name: val(`c${n}_last_name`),
      date_of_birth: val(`c${n}_date_of_birth`), sex: val(`c${n}_sex`), medical: val(`c${n}_medical`),
      program: checked(`c${n}_program`)
    };
  });
  const plan = checked('family_plan');
  const signature = padImage($('#pad-family'));
  const parentAge = ageFrom(parent.date_of_birth);

  // The first thing wrong with any child, as a message, or '' if they're all fine.
  const childProblem = (() => {
    for (const [i, c] of children.entries()) {
      const n = i + 1;
      const age = ageFrom(c.date_of_birth);
      if (!c.first_name || !c.last_name) return t('eChildName', { n });
      if (!c.date_of_birth) return t('eChildDob', { n });
      if (new Date(c.date_of_birth) > new Date()) return t('eChildFuture', { n });
      if (age !== null && age >= 18) return t('eChildAdult', { n });
      if (c.program === undefined) return t('eChildProgram', { n });
    }
    return '';
  })();

  const problem =
    !parent.first_name || !parent.last_name ? t('eName') :
    !parent.date_of_birth ? t('eDob') :
    parentAge === null || parentAge < 18 ? t('eParentAdult') :
    digitsOf(parent.phone).length < 7 ? t('ePhone') :
    parent.email && !looksLikeEmail(parent.email) ? t('eEmail') :
    training && parentProgram === undefined ? t('eYourProgram') :
    !emergency.emergency_name || digitsOf(emergency.emergency_phone).length < 7 ? t('eEmergency') :
    !children.length ? t('eNoChildren') :
    childProblem ||
    (!plan ? t('ePlan') :
    !signature ? t('eSign') :
    !form.agree.checked ? t('eAgree') : '');
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
  const parentName = `${parent.first_name} ${parent.last_name}`;
  const programLabelOf = key => KIOSK_PROGRAMS.find(([k]) => k === key)[1];
  const today = fmtDate(todayISO());
  const spanish = kioskLang === 'es' ? ' Filled in in Spanish.' : '';
  const planNote = plan === 'family' ? 'Family plan requested.' : 'Separate plans requested.';
  const kidNames = children.map(c => c.first_name).join(', ');

  // The people to save, the person who pays first (the parent if training, otherwise child 1),
  // so the others can point their family plan at them.
  const people = children.map(c => ({
    fields: {
      first_name: c.first_name, last_name: c.last_name, date_of_birth: c.date_of_birth,
      sex: c.sex || null, medical: c.medical, phone: parent.phone, alt_phone: '', email: '',
      address: parent.address, city: parent.city, state: parent.state, zip: parent.zip, ...emergency,
      guardian_name: parentName, guardian_relation: parent.relation, guardian_phone: parent.phone,
      guardian_email: parent.email
    },
    program: c.program,
    note: `Family sign-up at the front desk on ${today}. Parent: ${parentName}. Wants: ${programLabelOf(c.program)}. ${planNote}${spanish}`,
    kid: true
  }));
  if (training) {
    people.unshift({
      fields: {
        first_name: parent.first_name, last_name: parent.last_name, date_of_birth: parent.date_of_birth,
        sex: null, medical: parent.medical, phone: parent.phone, alt_phone: parent.alt_phone,
        email: parent.email, address: parent.address, city: parent.city, state: parent.state,
        zip: parent.zip, ...emergency, guardian_name: '', guardian_relation: '', guardian_phone: '',
        guardian_email: ''
      },
      program: parentProgram,
      note: `Family sign-up at the front desk on ${today}, with ${kidNames}. Wants: ${programLabelOf(parentProgram)}. ${planNote}${spanish}`,
      kid: false
    });
  }

  let payer = null;
  try {
    await loadAll();   // the latest members, so existing ones are matched, not duplicated
    for (const person of people) {
      // Plan: family plan billed to the payer and covering everyone else, or each their own.
      const planFields = plan === 'family'
        ? (payer ? { plan: 'covered', paid_by: payer.id } : { plan: 'family' })
        : { plan: person.program || 'auto' };
      const existing = findExisting(person.fields);
      let saved;
      if (existing) {
        const updates = {};
        for (const [key, value] of Object.entries(person.fields)) {
          if (value && !existing[key]) updates[key] = value;
        }
        // Only set the plan for someone who hasn't got one chosen yet.
        if (existing.plan === 'auto') Object.assign(updates, planFields);
        updates.review_note = existing.review_note ? `${existing.review_note} ${person.note}` : person.note;
        saved = await DB.saveMember(existing.id, updates);
      } else {
        saved = await DB.saveMember(null, {
          ...person.fields, date_of_birth: person.fields.date_of_birth || null, notes: '', active: true,
          custom_price: null, paid_by: null, ...planFields, review_note: person.note
        });
      }
      person.saved = saved;
      if (!payer) payer = saved;
    }
  } catch (e) {
    errorEl.textContent = t('eSave', { msg: e.message });
    errorEl.hidden = false;
    button.disabled = false;
    button.textContent = t('finish');
    return;
  }

  // One waiver per person, all signed with the parent's signature: as the participant for the
  // parent, as the parent/guardian for each child.
  try {
    for (const person of people) {
      const name = `${person.fields.first_name} ${person.fields.last_name}`;
      await DB.addWaiver({
        member_id: person.saved.id, kind: 'signed', version: WAIVER.version, waiver_text: signedWaiverText(),
        signed_name: name,
        signature: person.kid ? null : signature,
        guardian_name: person.kid ? parentName : '',
        guardian_signature: person.kid ? signature : null,
        signed_on: todayISO()
      });
    }
  } catch (e) {
    errorEl.textContent = t('eWaiver');
    errorEl.hidden = false;
    button.textContent = t('finish');
    return;
  }

  kioskFirstName = parent.first_name;
  kioskFamilyNames = kidNames;
  await loadAll().catch(() => {});
  form.reset();   // nothing left on screen for the next family
  go('#/kiosk-done');
}

// ---------- Hook into ui.js and kiosk.js ----------

Object.assign(SCREENS, { 'kiosk-family': { html: familyScreen, after: afterFamily } });
KIOSK_SCREENS.push('kiosk-family');
FORMS['family-form'] = onFamilySubmit;
Object.assign(ACTIONS, {
  'family-add-child': onAddChild,
  'family-remove-child': onRemoveChild
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'p-training') {
    $('#p-training-part').hidden = !e.target.checked;
  }
});
