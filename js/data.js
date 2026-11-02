// Every read and write goes through DB, so screens don't care whether we're in demo mode
// (browser storage) or connected to Supabase.

const MEMBER_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'address',
  'emergency_name', 'emergency_phone', 'emergency_relation', 'notes', 'active'
];

// ---------- Demo mode ----------

const DEMO_KEY = 'academy.demo.v1';

// Made-up people for trying the app. Never put real member details here.
function demoMembers() {
  const m = (first, last, phone, dob, extra = {}) => ({
    id: crypto.randomUUID(), first_name: first, last_name: last,
    email: `${first}.${last}@example.com`.toLowerCase(), phone, date_of_birth: dob,
    address: '', emergency_name: '', emergency_phone: '', emergency_relation: '',
    notes: '', active: true, created_at: new Date().toISOString(), ...extra
  });
  return [
    m('Alex', 'Testerson', '555-0101', '1990-04-12',
      { emergency_name: 'Sam Testerson', emergency_phone: '555-0102', emergency_relation: 'Partner' }),
    m('Bea', 'Sample', '555-0110', '2012-09-30',
      { emergency_name: 'Cora Sample', emergency_phone: '555-0111', emergency_relation: 'Mum',
        notes: 'Mild asthma, carries an inhaler.' }),
    m('Charlie', 'Demo', '555-0120', '1985-01-05', { address: '1 Example Street' }),
    m('Dana', 'Placeholder', '555-0130', '2001-07-21'),
    m('Eli', 'Fakename', '555-0140', '1978-11-02', { active: false, notes: 'Moved away.' }),
    m('Fran', 'Mockley', '555-0150', '2010-02-14',
      { emergency_name: 'Gus Mockley', emergency_phone: '555-0151', emergency_relation: 'Dad' })
  ];
}

// Made-up timetable, not the gym's real one.
function demoClasses() {
  const c = (name, days, start_time, end_time, instructor, capacity) => ({
    id: crypto.randomUUID(), name, days, start_time, end_time, instructor, capacity,
    notes: '', active: true, created_at: new Date().toISOString()
  });
  return [
    c('Kids Class', ['mon', 'wed'], '16:30', '17:15', 'Coach Example', 12),
    c('Adult Fundamentals', ['tue', 'thu'], '18:00', '19:00', 'Coach Sample', 20),
    c('Teen Class', ['fri'], '17:00', '18:00', 'Coach Example', 3),
    c('Open Mat', ['sat'], '10:00', '12:00', '', null)
  ];
}

function demoSeed() {
  const members = demoMembers();
  const classes = demoClasses();
  const enrol = (mi, ci) => ({ member_id: members[mi].id, class_id: classes[ci].id, enrolled_on: '2026-09-01' });
  const enrollments = [enrol(1, 0), enrol(5, 0), enrol(0, 1), enrol(2, 1), enrol(3, 1), enrol(1, 2), enrol(5, 2)];
  return { members, classes, enrollments };
}

function demoLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (saved && Array.isArray(saved.members)) {
      // Demo data saved before classes existed: add the made-up timetable.
      if (!Array.isArray(saved.classes)) {
        saved.classes = demoClasses();
        saved.enrollments = [];
      }
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
  // Put the made-up members and classes back, for testing.
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

  async function list(table, order) {
    let query = sb.from(table).select('*');
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) fail(error);
    return data;
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
    listMembers: () => list('members', 'first_name'),
    saveMember: (id, fields) => save('members', id, fields),
    listClasses: () => list('classes', 'name'),
    saveClass: (id, fields) => save('classes', id, fields),
    listEnrollments: () => list('enrollments'),
    async enroll(member_id, class_id) {
      const { data, error } = await sb.from('enrollments').insert({ member_id, class_id }).select().single();
      if (error) fail(error);
      return data;
    },
    async unenroll(member_id, class_id) {
      const { error } = await sb.from('enrollments').delete()
        .eq('member_id', member_id).eq('class_id', class_id);
      if (error) fail(error);
    }
  };
}

const DB = DEMO ? demoDB : supabaseDB();
