// Waivers: signing on screen (#/sign/MEMBER_ID), uploading a photo of a paper waiver
// (#/paper/MEMBER_ID), and viewing one (#/waiver/WAIVER_ID). The wording is in waiver-text.js.
// Under 18, a parent or guardian signs. A waiver lasts as long as they're a member, unless the
// wording changes (WAIVER.version).

function waiversOf(memberId) {
  return state.waivers.filter(w => w.member_id === memberId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// { ok, latest, label }: ok is true when their newest waiver is for the current wording.
function waiverStatus(m) {
  const latest = waiversOf(m.id)[0];
  if (!latest) return { ok: false, latest, label: 'No waiver yet' };
  if (latest.version !== WAIVER.version) {
    return { ok: false, latest, label: 'The waiver wording changed. They need to sign again.' };
  }
  const how = latest.kind === 'paper' ? 'Paper waiver on file'
    : latest.guardian_name ? `Signed by ${latest.guardian_name} (parent/guardian)` : 'Signed';
  return { ok: true, latest, label: `${how}, ${fmtDate(latest.signed_on)}` };
}

function isMinor(m) {
  const age = ageFrom(m.date_of_birth);
  return age !== null && age < 18;
}

// ---------- On the member page ----------

function memberWaiverCard(m) {
  const s = waiverStatus(m);
  const all = waiversOf(m.id);
  return `<div class="card ${s.ok ? '' : 'warn'}">
    <p class="${s.ok ? 'paid' : ''}"><strong>${s.ok ? '✓ ' : ''}${esc(s.label)}</strong></p>
    ${all.length ? `<ul class="plain pay-list">${all.map(w => `
      <li><a class="line" href="#/waiver/${encodeURIComponent(w.id)}">
        <strong>${w.kind === 'paper' ? 'Paper waiver (photo)' : 'Signed on screen'}</strong>
        <span class="muted small">${esc(fmtDate(w.signed_on))}${w.version !== WAIVER.version ? ' · older wording' : ''} · View</span>
      </a></li>`).join('')}</ul>` : ''}
    <div class="actions start">
      <a class="btn small-btn ${s.ok ? '' : 'primary'}" href="#/sign/${encodeURIComponent(m.id)}">Sign waiver</a>
      <a class="btn small-btn" href="#/paper/${encodeURIComponent(m.id)}">Upload paper copy</a>
    </div>
  </div>`;
}

// ---------- Sign on screen ----------

function waiverTextHtml(text) {
  return text.split('\n\n').map((p, i) =>
    i === 0 ? `<p class="waiver-gym">${esc(p)}</p>` : i === 1 ? `<h3 class="waiver-title">${esc(p)}</h3>` : `<p>${esc(p)}</p>`
  ).join('');
}

function signScreen(memberId) {
  const m = findMember(memberId);
  if (!m) return `${topBar('Sign waiver', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  const minor = isMinor(m);
  return `${topBar('Sign waiver', `#/m/${encodeURIComponent(m.id)}`)}
  <form id="sign-form" class="stack" data-member="${esc(m.id)}" novalidate>
    <div class="card waiver-text">${waiverTextHtml(waiverText())}</div>

    <div class="card stack">
      <label>Participant printed name *<input name="signed_name" value="${esc(fullName(m))}" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="minor" id="minor-check" ${minor ? 'checked' : ''}>
        Under 18 <span class="muted small">${m.date_of_birth ? `(age ${ageFrom(m.date_of_birth)})` : '(no date of birth on file)'}</span></label>
      <div>
        <div class="pad-label"><strong>Participant signature <span data-minor="adult">*</span><span data-minor="minor" class="muted small">(optional)</span></strong>
          <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-participant">Clear</button></div>
        <canvas class="sig-pad" id="pad-participant" aria-label="Participant signature: sign with your finger"></canvas>
      </div>
      <div data-minor="minor" class="stack">
        <label>Parent/guardian printed name *<input name="guardian_name" value="${esc(m.guardian_name)}" autocomplete="off"></label>
        <div>
          <div class="pad-label"><strong>Parent/guardian signature *</strong>
            <button type="button" class="link-btn" data-act="pad-clear" data-pad="pad-guardian">Clear</button></div>
          <canvas class="sig-pad" id="pad-guardian" aria-label="Parent or guardian signature: sign with your finger"></canvas>
        </div>
      </div>
      <p class="small">Date: <strong>${esc(fmtDate(todayISO()))}</strong></p>
      <label class="check"><input type="checkbox" name="agree"> I have read this waiver and agree to it.</label>
    </div>

    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="#/m/${encodeURIComponent(m.id)}">Cancel</a>
      <button class="btn primary" type="submit">Save signed waiver</button>
    </div>
  </form>`;
}

// Show the parent/guardian part only for under-18s. Signature boxes are set up once they're
// visible, since a hidden box has no size to draw at.
function syncMinor() {
  const minor = $('#minor-check')?.checked;
  document.querySelectorAll('[data-minor]').forEach(el => {
    el.hidden = el.dataset.minor !== (minor ? 'minor' : 'adult');
  });
  document.querySelectorAll('.sig-pad').forEach(c => {
    if (!c.dataset.ready && c.offsetWidth) setupPad(c);
  });
}

// A finger/mouse signature box. The canvas is drawn at screen sharpness; data-signed marks
// whether anything has been drawn.
function setupPad(canvas) {
  canvas.dataset.ready = '1';
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  Object.assign(ctx, { lineWidth: 2.5, lineCap: 'round', lineJoin: 'round', strokeStyle: '#111' });
  canvas.dataset.signed = '';
  let last = null;
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener('pointerdown', e => {
    last = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* keeps working without it */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!last) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(...last);
    ctx.lineTo(...p);
    ctx.stroke();
    last = p;
    canvas.dataset.signed = '1';
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => canvas.addEventListener(t, () => { last = null; }));
}

function clearPad(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  canvas.dataset.signed = '';
}

// The signature as a PNG, scaled to 600px wide to keep it small. Null if nothing was drawn.
function padImage(canvas) {
  if (!canvas || !canvas.dataset.signed) return null;
  const out = document.createElement('canvas');
  out.width = 600;
  out.height = Math.round(600 * canvas.height / canvas.width);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function afterSign() {
  syncMinor();
}

async function onSaveSigned(form) {
  const minor = form.minor.checked;
  const fields = {
    member_id: form.dataset.member,
    kind: 'signed',
    version: WAIVER.version,
    waiver_text: waiverText(),
    signed_name: form.signed_name.value.trim(),
    signature: padImage($('#pad-participant')),
    guardian_name: minor ? form.guardian_name.value.trim() : '',
    guardian_signature: minor ? padImage($('#pad-guardian')) : null,
    signed_on: todayISO()
  };
  const problem =
    !fields.signed_name ? 'Add the participant’s printed name.' :
    !minor && !fields.signature ? 'The participant needs to sign in the box.' :
    minor && !fields.guardian_name ? 'Add the parent or guardian’s printed name.' :
    minor && !fields.guardian_signature ? 'The parent or guardian needs to sign in the box.' :
    !form.agree.checked ? 'Tick the box to agree to the waiver.' : '';
  await saveWaiver(form, fields, problem);
}

// Shared by both kinds of waiver: show a problem, or save and go back to the member.
async function saveWaiver(form, fields, problem) {
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
    state.waivers.push(await DB.addWaiver(fields));
    toast('Waiver saved');
    go(`#/m/${encodeURIComponent(fields.member_id)}`);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

// ---------- Upload a paper waiver ----------

let paperPhoto = null;   // the shrunk photo waiting to be saved

function paperScreen(memberId) {
  const m = findMember(memberId);
  if (!m) return `${topBar('Paper waiver', '#/members')}<p class="empty">This member wasn’t found.</p>`;
  paperPhoto = null;
  return `${topBar('Paper waiver', `#/m/${encodeURIComponent(m.id)}`)}
  <p class="muted center">Take a clear photo of <strong>${esc(fullName(m))}</strong>’s signed paper waiver
    (the signature page).</p>
  <form id="paper-form" class="stack" data-member="${esc(m.id)}" novalidate>
    <div class="card stack">
      <label class="btn photo-btn">📷 Take or choose photo
        <input type="file" name="photo" id="paper-photo" accept="image/*" capture="environment"></label>
      <img id="paper-preview" class="paper-preview" alt="Preview of the paper waiver" hidden>
      <label>Name signed on the waiver *<input name="signed_name" value="${esc(fullName(m))}" autocomplete="off"></label>
      <label><span>Parent/guardian name <span class="muted small">(if under 18)</span></span>
        <input name="guardian_name" autocomplete="off"></label>
      <label>Date on the waiver<input name="signed_on" type="date" value="${esc(todayISO())}" max="${esc(todayISO())}"></label>
    </div>
    <p id="form-error" class="error" hidden></p>
    <div class="actions end">
      <a class="btn" href="#/m/${encodeURIComponent(m.id)}">Cancel</a>
      <button class="btn primary" type="submit">Save paper waiver</button>
    </div>
  </form>`;
}

// Phone photos are several MB; shrink to a readable JPEG. Demo mode keeps them smaller so
// they fit in browser storage.
async function shrinkPhoto(file) {
  const maxSide = DEMO ? 900 : 1800;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', DEMO ? 0.6 : 0.8));
}

async function onPaperPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    paperPhoto = await shrinkPhoto(file);
    const preview = $('#paper-preview');
    preview.src = URL.createObjectURL(paperPhoto);
    preview.hidden = false;
  } catch (e) {
    paperPhoto = null;
    toast('That file couldn’t be opened as a photo.');
  }
}

async function onSavePaper(form) {
  const memberId = form.dataset.member;
  const fields = {
    member_id: memberId,
    kind: 'paper',
    version: WAIVER.version,
    waiver_text: waiverText(),
    signed_name: form.signed_name.value.trim(),
    guardian_name: form.guardian_name.value.trim(),
    signed_on: form.signed_on.value || todayISO()
  };
  const problem =
    !paperPhoto ? 'Take or choose a photo of the waiver.' :
    !fields.signed_name ? 'Add the name signed on the waiver.' : '';
  if (!problem) {
    try {
      form.querySelector('button[type=submit]').disabled = true;
      fields.photo_path = await DB.uploadWaiverPhoto(memberId, paperPhoto);
    } catch (e) {
      form.querySelector('button[type=submit]').disabled = false;
      return saveWaiver(form, fields, e.message);
    }
  }
  await saveWaiver(form, fields, problem);
}

// ---------- View a waiver ----------

function waiverScreen(id) {
  const w = state.waivers.find(x => x.id === id);
  const back = w ? `#/m/${encodeURIComponent(w.member_id)}` : '#/members';
  return `${topBar('Waiver', back)}
  <div id="waiver-view"><p class="empty">Loading waiver…</p></div>`;
}

async function afterWaiver(id) {
  const box = $('#waiver-view');
  try {
    const w = await DB.getWaiver(id);
    if (!w) {
      box.innerHTML = '<p class="empty">This waiver wasn’t found.</p>';
      return;
    }
    const photo = w.photo_path ? await DB.waiverPhotoUrl(w.photo_path) : null;
    if (!$('#waiver-view')) return;   // they moved on while it loaded
    const sig = (label, name, img) => `
      <div class="sig-block">
        <span class="muted small">${label}</span>
        ${img ? `<img class="sig-img" src="${esc(img)}" alt="${esc(label)}">` : ''}
        <strong>${esc(name)}</strong>
      </div>`;
    box.innerHTML = `
      ${w.kind === 'paper' ? `
        <div class="card stack">
          <p><strong>Paper waiver</strong> · ${esc(fmtDate(w.signed_on))}</p>
          ${photo ? `<a href="${esc(photo)}" target="_blank" rel="noopener"><img class="paper-preview" src="${esc(photo)}" alt="Photo of the paper waiver"></a>
            <p class="muted small">Tap the photo to open it full size.</p>` : '<p class="muted">No photo found.</p>'}
          <p>Signed by <strong>${esc(w.signed_name)}</strong>${w.guardian_name ? `, parent/guardian <strong>${esc(w.guardian_name)}</strong>` : ''}</p>
        </div>` : `
        <div class="card waiver-text printable">
          ${waiverTextHtml(w.waiver_text)}
          ${sig('Participant', w.signed_name, w.signature)}
          ${w.guardian_name ? sig('Parent/guardian (under 18)', w.guardian_name, w.guardian_signature) : ''}
          <p>Date: <strong>${esc(fmtDate(w.signed_on))}</strong></p>
        </div>`}
      <p class="muted small center">Saved by ${esc(w.recorded_by || 'staff')} · wording version ${esc(w.version)}${w.version !== WAIVER.version ? ' (older wording)' : ''}</p>
      ${w.kind === 'signed' ? '<p class="center"><button class="btn" data-act="print">Print</button></p>' : ''}`;
  } catch (e) {
    box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}

// ---------- Hook into ui.js ----------

Object.assign(SCREENS, {
  sign: { html: signScreen, after: afterSign },
  paper: { html: paperScreen },
  waiver: { html: waiverScreen, after: afterWaiver }
});

Object.assign(FORMS, { 'sign-form': onSaveSigned, 'paper-form': onSavePaper });

Object.assign(ACTIONS, {
  'pad-clear'(el) {
    clearPad($('#' + el.dataset.pad));
  },
  print() {
    window.print();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'minor-check') syncMinor();
  if (e.target.id === 'paper-photo') onPaperPhoto(e.target);
});
