// Every read and write goes through DB, so screens don't care whether we're in demo mode
// (browser storage) or connected to Supabase.

const MEMBER_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'address',
  'emergency_name', 'emergency_phone', 'emergency_relation', 'notes', 'active'
];

// ---------- Demo mode ----------

const DEMO_KEY = 'academy.demo.v1';

// Made-up people for trying the app. Never put real member details here.
function demoSeed() {
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

function demoLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (saved && Array.isArray(saved.members)) return saved;
  } catch (e) { /* storage blocked or broken: start fresh */ }
  return { signedIn: false, members: demoSeed() };
}

function demoSave(data) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); } catch (e) { /* not saved */ }
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
    let row = this.data.members.find(m => m.id === id);
    if (row) Object.assign(row, fields, { updated_at: new Date().toISOString() });
    else {
      row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...fields };
      this.data.members.push(row);
    }
    demoSave(this.data);
    return { ...row };
  },
  // Put the made-up members back, for testing.
  reset() {
    this.data = { signedIn: true, members: demoSeed() };
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
    async listMembers() {
      const { data, error } = await sb.from('members').select('*').order('first_name');
      if (error) fail(error);
      return data;
    },
    async saveMember(id, fields) {
      const query = id
        ? sb.from('members').update(fields).eq('id', id)
        : sb.from('members').insert(fields);
      const { data, error } = await query.select().single();
      if (error) fail(error);
      return data;
    }
  };
}

const DB = DEMO ? demoDB : supabaseDB();
