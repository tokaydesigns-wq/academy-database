// Every read and write goes through DB, so screens don't care whether we're in demo mode
// (browser storage) or connected to Supabase.

// Text fields on the member form (the enrollment form's fields).
const MEMBER_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'alt_phone', 'date_of_birth', 'sex',
  'address', 'city', 'state', 'zip', 'medical',
  'emergency_name', 'emergency_phone', 'emergency_alt_phone', 'emergency_relation', 'notes', 'active'
];

// Waiver columns loaded up front. The text and signature images are only fetched when a
// waiver is opened, since they're large.
const WAIVER_LIST_COLUMNS =
  'id,member_id,kind,version,signed_name,guardian_name,photo_path,signed_on,recorded_by,created_at';

// ---------- Demo mode ----------

// v3 added waivers and the enrollment form fields; older demo data is simply replaced.
const DEMO_KEY = 'academy.demo.v3';   // pauses were added later; demoLoad fills them in

// Made-up people for trying the app. Never put real member details here.
function demoMembers() {
  const m = (first, last, phone, dob, extra = {}) => ({
    id: crypto.randomUUID(), first_name: first, last_name: last,
    email: `${first}.${last}@example.com`.toLowerCase(), phone, date_of_birth: dob,
    address: '', city: '', state: '', zip: '', alt_phone: '', sex: null, medical: '',
    emergency_name: '', emergency_phone: '', emergency_alt_phone: '', emergency_relation: '',
    notes: '', active: true, plan: 'auto', custom_price: null, paid_by: null, review_note: '',
    created_at: new Date().toISOString(), ...extra
  });
  return [
    m('Alex', 'Testerson', '555-0101', '1990-04-12',
      { emergency_name: 'Sam Testerson', emergency_phone: '555-0102', emergency_relation: 'Partner' }),
    m('Bea', 'Sample', '555-0110', '2012-09-30',
      { emergency_name: 'Cora Sample', emergency_phone: '555-0111', emergency_relation: 'Mum',
        medical: 'Mild asthma, carries an inhaler.', sex: 'female' }),
    m('Charlie', 'Demo', '555-0120', '1985-01-05',
      { address: '1 Example Street', city: 'Exampleton', state: 'WI', zip: '00000', sex: 'male' }),
    m('Dana', 'Placeholder', '555-0130', '2001-07-21'),
    m('Eli', 'Fakename', '555-0140', '1978-11-02', { active: false, notes: 'Moved away.' }),
    m('Fran', 'Mockley', '555-0150', '2010-02-14',
      { emergency_name: 'Gus Mockley', emergency_phone: '555-0151', emergency_relation: 'Dad' })
  ];
}

// Made-up timetable, not the gym's real one.
function demoClasses() {
  const c = (name, program, days, start_time, end_time, instructor, capacity) => ({
    id: crypto.randomUUID(), name, program, days, start_time, end_time, instructor, capacity,
    notes: '', active: true, created_at: new Date().toISOString()
  });
  return [
    c('Kickboxing', 'kickboxing', ['mon', 'wed'], '18:00', '19:00', 'Coach Example', 20),
    c('Muay Thai', 'muay_thai', ['tue', 'thu'], '18:00', '19:00', 'Coach Sample', 15),
    c('Kids Jiu Jitsu', 'jiu_jitsu', ['fri'], '17:00', '18:00', 'Coach Example', 3),
    c('Open Mat', null, ['sat'], '10:00', '12:00', '', null)
  ];
}

function demoSeed() {
  const members = demoMembers();
  const classes = demoClasses();
  const enrol = (mi, ci) => ({ member_id: members[mi].id, class_id: classes[ci].id, enrolled_on: '2026-09-01' });
  const enrollments = [enrol(1, 0), enrol(5, 0), enrol(0, 1), enrol(2, 0), enrol(3, 1), enrol(3, 2),
    enrol(1, 2), enrol(5, 2)];
  // Fran's parent pays the family plan; Bea is covered by it.
  members[5].plan = 'family';
  Object.assign(members[1], { plan: 'covered', paid_by: members[5].id });
  const month = thisMonth();
  const pay = (mi, cents, method, covers = month) => ({
    id: crypto.randomUUID(), member_id: members[mi].id, amount: cents / 100, paid_on: todayISO(),
    covers_month: covers, method, note: '', recorded_by: 'demo@example.com',
    created_at: new Date().toISOString()
  });
  const payments = [pay(0, 5999, 'card'), pay(5, 15000, 'cash'), pay(0, 5999, 'card', shiftMonth(month, -1)),
    pay(3, 3000, 'cash')];
  // Alex signed the current waiver, Fran's dad signed for her, and Dana signed an older
  // version (so she's asked to sign again). Bea and Charlie have none yet.
  const scribble = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><path d="M10 70 C40 10 60 90 90 40 S140 80 170 30 S230 70 290 40" fill="none" stroke="#123" stroke-width="3"/></svg>');
  const waiver = (mi, extra) => ({
    id: crypto.randomUUID(), member_id: members[mi].id, kind: 'signed', version: WAIVER.version,
    waiver_text: waiverText(), signed_name: fullName(members[mi]), signature: scribble,
    guardian_name: '', guardian_signature: null, photo_path: null, signed_on: todayISO(),
    recorded_by: 'demo@example.com', created_at: new Date().toISOString(), ...extra
  });
  const waivers = [waiver(0), waiver(5, { signature: null, guardian_name: 'Gus Mockley', guardian_signature: scribble }),
    waiver(3, { version: '0', signed_on: '2025-01-15' })];
  // Alex was added three months ago, so earlier months count for him. Charlie is taking
  // this month and next off.
  members[0].created_at = `${shiftMonth(month, -3)}-01T12:00:00`;
  const pauses = [{ id: crypto.randomUUID(), member_id: members[2].id, start_month: month,
    end_month: shiftMonth(month, 1), note: 'Knee surgery', created_by: 'demo@example.com',
    created_at: new Date().toISOString() }];
  return { members, classes, enrollments, payments, waivers, pauses };
}

function demoLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (saved && Array.isArray(saved.members)) {
      saved.pauses = saved.pauses || [];   // demo data saved before pauses existed
      return saved;
    }
  } catch (e) { /* storage blocked or broken: start fresh */ }
  return { signedIn: false, ...demoSeed() };
}

function demoSave(data) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); } catch (e) { /* not saved */ }
}

// Insert or update a row in one of the demo lists.
function demoUpsert(list, id, fields) {
  let row = list.find(r => r.id === id);
  if (row) Object.assign(row, fields, { updated_at: new Date().toISOString() });
  else {
    row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...fields };
    list.push(row);
  }
  return { ...row };
}

const demoDB = {
  data: demoLoad(),
  async currentUser() {
    return this.data.signedIn ? { email: 'demo@example.com' } : null;
  },
  async signIn() {
    this.data.signedIn = true;
    demoSave(this.data);
    return { email: 'demo@example.com' };
  },
  async signOut() {
    this.data.signedIn = false;
    demoSave(this.data);
  },
  async changePassword() {
    throw new Error('Passwords aren’t used in demo mode.');
  },
  // Leaving front desk mode: any password works in demo mode.
  async checkPassword(password) {
    if (!password) throw new Error('Enter the staff password.');
  },
  async listMembers() {
    return this.data.members.map(m => ({ ...m }));
  },
  async saveMember(id, fields) {
    const row = demoUpsert(this.data.members, id, fields);
    demoSave(this.data);
    return row;
  },
  async listClasses() {
    return this.data.classes.map(c => ({ ...c }));
  },
  async saveClass(id, fields) {
    const row = demoUpsert(this.data.classes, id, fields);
    demoSave(this.data);
    return row;
  },
  async deleteClass(id) {
    if (this.data.enrollments.some(e => e.class_id === id)) {
      throw new Error('Take everyone out of this class before deleting it.');
    }
    this.data.classes = this.data.classes.filter(c => c.id !== id);
    demoSave(this.data);
  },
  async listEnrollments() {
    return this.data.enrollments.map(e => ({ ...e }));
  },
  async enroll(member_id, class_id) {
    const row = { member_id, class_id, enrolled_on: new Date().toISOString().slice(0, 10) };
    this.data.enrollments.push(row);
    demoSave(this.data);
    return { ...row };
  },
  async unenroll(member_id, class_id) {
    this.data.enrollments = this.data.enrollments
      .filter(e => !(e.member_id === member_id && e.class_id === class_id));
    demoSave(this.data);
  },
  async listPayments() {
    return this.data.payments.map(p => ({ ...p }));
  },
  async addPayment(fields) {
    const row = { id: crypto.randomUUID(), recorded_by: 'demo@example.com',
      created_at: new Date().toISOString(), ...fields };
    this.data.payments.push(row);
    demoSave(this.data);
    return { ...row };
  },
  async deletePayment(id) {
    this.data.payments = this.data.payments.filter(p => p.id !== id);
    demoSave(this.data);
  },
  async listWaivers() {
    const cols = WAIVER_LIST_COLUMNS.split(',');
    return this.data.waivers.map(w => Object.fromEntries(cols.map(c => [c, w[c]])));
  },
  async getWaiver(id) {
    const w = this.data.waivers.find(x => x.id === id);
    return w ? { ...w } : null;
  },
  async addWaiver(fields) {
    const row = { id: crypto.randomUUID(), recorded_by: 'demo@example.com',
      created_at: new Date().toISOString(), ...fields };
    this.data.waivers.push(row);
    demoSave(this.data);
    return { ...row };
  },
  // In demo mode the "path" is the photo itself, kept small to fit in browser storage.
  async uploadWaiverPhoto(memberId, blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Couldn’t read that photo.'));
      reader.readAsDataURL(blob);
    });
  },
  async waiverPhotoUrl(path) {
    return path;
  },
  async listPauses() {
    return this.data.pauses.map(p => ({ ...p }));
  },
  async savePause(id, fields) {
    const row = demoUpsert(this.data.pauses, id, { created_by: 'demo@example.com', ...fields });
    demoSave(this.data);
    return row;
  },
  async deletePause(id) {
    this.data.pauses = this.data.pauses.filter(p => p.id !== id);
    demoSave(this.data);
  },
  // Put the made-up data back, for testing.
  reset() {
    this.data = { signedIn: true, ...demoSeed() };
    demoSave(this.data);
  }
};

// ---------- Supabase ----------

function supabaseDB() {
  const sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

  // Supabase errors are technical; turn the common ones into plain words.
  const fail = (error) => {
    const msg = error.message || '';
    if (/invalid login/i.test(msg)) throw new Error('That email and password don’t match.');
    if (/fetch|network/i.test(msg)) throw new Error('Can’t reach the database. Check the internet connection.');
    if (error.code === '23505') throw new Error('They’re already in that class.');
    if (error.code === '42P01' || /does not exist|schema cache/i.test(msg)) {
      throw new Error('The database needs updating. Run supabase/schema.sql again in Supabase.');
    }
    throw new Error(msg || 'Something went wrong.');
  };

  // Signed in AND on the staff list, or null.
  async function staffUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data: ok, error } = await sb.rpc('is_staff');
    if (error) fail(error);
    if (!ok) {
      await sb.auth.signOut();
      throw new Error('You’re signed in, but your email isn’t on the staff list yet. Ask the owner to add it.');
    }
    return { email: session.user.email };
  }

  // Supabase sends at most 1,000 rows per request, so fetch in pages of 1,000 until a page
  // comes back short. Sorting by a unique key as well keeps the pages from overlapping.
  const PAGE = 1000;
  async function list(table, { order, columns = '*', keys = ['id'] } = {}) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      let query = sb.from(table).select(columns);
      for (const col of [order, ...keys].filter(Boolean)) query = query.order(col);
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) fail(error);
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  async function save(table, id, fields) {
    const query = id
      ? sb.from(table).update(fields).eq('id', id)
      : sb.from(table).insert(fields);
    const { data, error } = await query.select().single();
    if (error) fail(error);
    return data;
  }

  return {
    currentUser: staffUser,
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) fail(error);
      return staffUser();
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async changePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) fail(error);
    },
    // Leaving front desk mode: signing in again with the same email proves the password.
    async checkPassword(password) {
      const { data: { session } } = await sb.auth.getSession();
      const { error } = await sb.auth.signInWithPassword({ email: session.user.email, password });
      if (error) throw new Error('That password isn’t right.');
    },
    listMembers: () => list('members', { order: 'first_name' }),
    saveMember: (id, fields) => save('members', id, fields),
    listClasses: () => list('classes', { order: 'name' }),
    saveClass: (id, fields) => save('classes', id, fields),
    // The database only allows deleting a class nobody is signed up for. If it refuses,
    // nothing comes back, so check that a row was actually deleted.
    async deleteClass(id) {
      const { data, error } = await sb.from('classes').delete().eq('id', id).select('id');
      if (error) fail(error);
      if (!data.length) throw new Error('This class couldn’t be deleted. Take everyone out of it first.');
    },
    listEnrollments: () => list('enrollments', { keys: ['member_id', 'class_id'] }),
    async enroll(member_id, class_id) {
      const { data, error } = await sb.from('enrollments').insert({ member_id, class_id }).select().single();
      if (error) fail(error);
      return data;
    },
    async unenroll(member_id, class_id) {
      const { error } = await sb.from('enrollments').delete()
        .eq('member_id', member_id).eq('class_id', class_id);
      if (error) fail(error);
    },
    listPayments: () => list('payments', { order: 'paid_on' }),
    async addPayment(fields) {
      const { data, error } = await sb.from('payments').insert(fields).select().single();
      if (error) fail(error);
      return data;
    },
    async deletePayment(id) {
      const { error } = await sb.from('payments').delete().eq('id', id);
      if (error) fail(error);
    },
    listWaivers: () => list('waivers', { columns: WAIVER_LIST_COLUMNS }),
    async getWaiver(id) {
      const { data, error } = await sb.from('waivers').select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return data;
    },
    async addWaiver(fields) {
      const { data, error } = await sb.from('waivers').insert(fields).select(WAIVER_LIST_COLUMNS).single();
      if (error) fail(error);
      return data;
    },
    // Paper waiver photos go in the private "waivers" bucket, in a folder per member.
    async uploadWaiverPhoto(memberId, blob) {
      const path = `${memberId}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('waivers').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) fail(error);
      return path;
    },
    // A private link to a photo that works for an hour.
    async waiverPhotoUrl(path) {
      const { data, error } = await sb.storage.from('waivers').createSignedUrl(path, 3600);
      if (error) fail(error);
      return data.signedUrl;
    },
    listPauses: () => list('pauses'),
    savePause: (id, fields) => save('pauses', id, fields),
    async deletePause(id) {
      const { error } = await sb.from('pauses').delete().eq('id', id);
      if (error) fail(error);
    }
  };
}

const DB = DEMO ? demoDB : supabaseDB();
