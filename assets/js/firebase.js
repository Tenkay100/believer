// ── AMERICAN FIRST FINANCIAL — FIREBASE CLIENT COMPAT ──
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyDg78xkq9DgW9vLni40LdocrhnQLy0HZfI",
  authDomain: "afbswift-d29cc.firebaseapp.com",
  projectId: "afbswift-d29cc",
  storageBucket: "afbswift-d29cc.firebasestorage.app",
  messagingSenderId: "1054552459329",
  appId: "1:1054552459329:web:dbbadd68d3bdbccff31ec0"
};

let db = null;
let auth = null;
let storage = null;

export function initFirebase() {
  if (typeof window !== 'undefined' && window.firebase) {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    db = window.firebase.firestore();
    auth = window.firebase.auth();
    storage = window.firebase.storage();
    return window.firebase;
  }
  console.warn('Firebase not loaded. Add the CDN scripts to your HTML.');
  return null;
}

export function getFirebase() {
  if (!db) initFirebase();
  return window.firebase;
}

// Chained Query Builder to mimic Supabase's chained query API
export class FirebaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.selectFields = '*';
    this.filters = [];
    this.orderByField = null;
    this.orderAscending = false;
    this.limitVal = null;
    this.isSingle = false;
    this.action = 'select';
    this.actionValues = null;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(key, value) {
    this.filters.push({ type: 'eq', key, value });
    return this;
  }

  neq(key, value) {
    this.filters.push({ type: 'neq', key, value });
    return this;
  }

  in(key, array) {
    this.filters.push({ type: 'in', key, value: array });
    return this;
  }

  order(column, options = {}) {
    this.orderByField = column;
    this.orderAscending = options.ascending ?? false;
    return this;
  }

  limit(value) {
    this.limitVal = value;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(values) {
    this.action = 'insert';
    this.actionValues = values;
    return this;
  }

  update(values) {
    this.action = 'update';
    this.actionValues = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  // Thenable execution for await compatibility
  async then(resolve, reject) {
    try {
      const res = await this.execute();
      if (resolve) resolve(res);
      return res;
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }

  async execute() {
    const fApp = getFirebase();
    if (!fApp) return { data: null, error: { message: "Firebase not initialized" } };

    const firestore = fApp.firestore();
    const colRef = firestore.collection(this.table);

    if (this.action === 'insert') {
      try {
        const isArray = Array.isArray(this.actionValues);
        const toInsert = isArray ? this.actionValues : [this.actionValues];
        const results = [];

        for (const item of toInsert) {
          let docRef;
          const dataToSet = {
            ...item,
            created_at: item.created_at || new Date().toISOString()
          };
          if (item.id) {
            docRef = colRef.doc(item.id);
            await docRef.set(dataToSet);
          } else {
            docRef = await colRef.add(dataToSet);
          }
          const docSnap = await docRef.get();
          results.push({ id: docRef.id, ...docSnap.data() });
        }

        return { data: isArray ? results : results[0], error: null };
      } catch (err) {
        console.error("Firestore insert error:", err);
        return { data: null, error: err };
      }
    }

    if (this.action === 'update' || this.action === 'delete') {
      try {
        let q = colRef;
        console.log(`[FirebaseQueryBuilder] ${this.action} on ${this.table} with filters:`, JSON.stringify(this.filters));
        this.filters.forEach(f => {
          const key = f.key === 'id' ? window.firebase.firestore.FieldPath.documentId() : f.key;
          if (f.type === 'eq') q = q.where(key, '==', f.value);
          else if (f.type === 'neq') q = q.where(key, '!=', f.value);
          else if (f.type === 'in') q = q.where(key, 'in', f.value);
        });

        const snapshot = await q.get();
        console.log(`[FirebaseQueryBuilder] matched docs: ${snapshot.size}`);
        const batch = firestore.batch();
        const results = [];

        snapshot.forEach(doc => {
          const docRef = colRef.doc(doc.id);
          console.log(`[FirebaseQueryBuilder] queuing delete/update for doc ID: ${doc.id}`);
          if (this.action === 'update') {
            batch.update(docRef, this.actionValues);
            results.push({ id: doc.id, ...doc.data(), ...this.actionValues });
          } else {
            batch.delete(docRef);
          }
        });

        await batch.commit();
        console.log(`[FirebaseQueryBuilder] batch commit successful`);
        return { data: this.action === 'update' ? results : null, error: null };
      } catch (err) {
        console.error("Firestore update/delete error:", err);
        return { data: null, error: err };
      }
    }

    // Default select action
    try {
      let q = colRef;
      this.filters.forEach(f => {
        const key = f.key === 'id' ? window.firebase.firestore.FieldPath.documentId() : f.key;
        if (f.type === 'eq') q = q.where(key, '==', f.value);
        else if (f.type === 'neq') q = q.where(key, '!=', f.value);
        else if (f.type === 'in') {
          if (f.value.length === 0) {
            q = q.where(window.firebase.firestore.FieldPath.documentId(), '==', 'nonexistent_id_val');
          } else {
            q = q.where(key, 'in', f.value);
          }
        }
      });

      const snapshot = await q.get();
      let results = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });

      if (this.orderByField) {
        results.sort((a, b) => {
          const valA = a[this.orderByField];
          const valB = b[this.orderByField];
          if (valA === undefined || valB === undefined) return 0;
          
          // Try parsing dates/numbers for comparison
          const parsedA = Date.parse(valA) || Number(valA) || String(valA).toLowerCase();
          const parsedB = Date.parse(valB) || Number(valB) || String(valB).toLowerCase();
          
          if (parsedA < parsedB) return this.orderAscending ? -1 : 1;
          if (parsedA > parsedB) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }

      if (this.limitVal) {
        results = results.slice(0, this.limitVal);
      }

      // Handle simulated joins (e.g., cards requesting users(full_name))
      if (this.table === 'cards' && this.selectFields.includes('users(')) {
        for (let card of results) {
          if (card.user_id) {
            const userDoc = await firestore.collection('users').doc(card.user_id).get();
            if (userDoc.exists) {
              card.users = { full_name: userDoc.data().full_name };
            }
          }
        }
      }

      if (this.isSingle) {
        return { data: results[0] || null, error: null };
      }

      return { data: results, error: null };
    } catch (err) {
      console.error("Firestore select error:", err);
      return { data: null, error: err };
    }
  }
}

// Export compat function matching getSupabase() for transparent legacy support
export function getSupabase() {
  getFirebase();
  return {
    from: (table) => new FirebaseQueryBuilder(table),
    auth: {
      signUp: async ({ email, password, options }) => {
        try {
          const res = await window.firebase.auth().createUserWithEmailAndPassword(email, password);
          const uid = res.user.uid;
          if (options && options.data) {
            await window.firebase.firestore().collection('users').doc(uid).set({
              id: uid,
              email,
              ...options.data,
              created_at: new Date().toISOString()
            });
          }
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signInWithPassword: async ({ email, password }) => {
        try {
          const res = await window.firebase.auth().signInWithEmailAndPassword(email, password);
          return { data: res, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signOut: async () => {
        try {
          await window.firebase.auth().signOut();
          return { error: null };
        } catch (err) {
          return { error: err };
        }
      },
      getSession: async () => {
        const user = window.firebase.auth().currentUser;
        if (user) {
          return { data: { session: { user: { id: user.uid, email: user.email } } } };
        }
        return { data: { session: null } };
      },
      getUser: async () => {
        const user = window.firebase.auth().currentUser;
        return { data: { user } };
      }
    },
    storage: {
      from: (bucket) => {
        return {
          upload: async (path, file) => {
            try {
              const ref = window.firebase.storage().ref().child(`${bucket}/${path}`);
              const snapshot = await ref.put(file);
              return { data: snapshot, error: null };
            } catch (err) {
              return { data: null, error: err };
            }
          },
          getPublicUrl: (path) => {
            const bucketName = firebaseConfig.storageBucket || `${firebaseConfig.projectId}.appspot.com`;
            const encodedPath = encodeURIComponent(`${bucket}/${path}`);
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
            return { publicUrl };
          }
        };
      }
    }
  };
}

export { initFirebase as initSupabase };

// ── AUTH HELPERS ──
export async function signUp(email, password, metadata = {}) {
  const dbCompat = getSupabase();
  return await dbCompat.auth.signUp({
    email, password,
    options: { data: metadata }
  });
}

export async function signIn(email, password) {
  const dbCompat = getSupabase();
  return await dbCompat.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  localStorage.removeItem('mock_session');
  const dbCompat = getSupabase();
  return await dbCompat.auth.signOut();
}

export async function getSession() {
  const mock = localStorage.getItem('mock_session');
  if (mock) return JSON.parse(mock);

  const dbCompat = getSupabase();
  const { data: { session } } = await dbCompat.auth.getSession();
  return session;
}

export async function getUser() {
  const mock = localStorage.getItem('mock_session');
  if (mock) return JSON.parse(mock).user;

  const dbCompat = getSupabase();
  const { data: { user } } = await dbCompat.auth.getUser();
  return user;
}

export async function resetPassword(email) {
  try {
    getFirebase();
    await window.firebase.auth().sendPasswordResetEmail(email);
    return { data: {}, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ── DATABASE HELPERS ──
export async function dbSelect(table, query = {}) {
  let q = new FirebaseQueryBuilder(table).select(query.select || '*');
  if (query.eq) Object.entries(query.eq).forEach(([k, v]) => q = q.eq(k, v));
  if (query.neq) Object.entries(query.neq).forEach(([k, v]) => q = q.neq(k, v));
  if (query.order) q = q.order(query.order.column, { ascending: query.order.ascending ?? false });
  if (query.limit) q = q.limit(query.limit);
  if (query.range) q = q.range(query.range[0], query.range[1]);
  return await q;
}

export async function dbInsert(table, values) {
  return await new FirebaseQueryBuilder(table).insert(values);
}

export async function dbUpdate(table, values, match) {
  let q = new FirebaseQueryBuilder(table).update(values);
  Object.entries(match).forEach(([k, v]) => q = q.eq(k, v));
  return await q;
}

export async function dbDelete(table, match) {
  let q = new FirebaseQueryBuilder(table).delete();
  Object.entries(match).forEach(([k, v]) => q = q.eq(k, v));
  return await q;
}

// ── REALTIME SUBSCRIPTIONS ──
export function subscribeToTable(table, callback, filter = null) {
  getFirebase();
  let q = window.firebase.firestore().collection(table);

  if (filter) {
    const parts = filter.split('=');
    if (parts.length === 2) {
      const field = parts[0];
      const condition = parts[1];
      if (condition.startsWith('eq.')) {
        const val = condition.replace('eq.', '');
        q = q.where(field, '==', val);
      }
    }
  }

  const unsubscribe = q.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        callback({
          event: change.type === 'added' ? 'INSERT' : 'UPDATE',
          new: { id: change.doc.id, ...change.doc.data() }
        });
      }
    });
  }, error => {
    console.error("Realtime subscription error:", error);
  });

  return unsubscribe;
}

export function unsubscribe(channel) {
  if (typeof channel === 'function') {
    channel();
  }
}

// ── STORAGE HELPERS ──
export async function uploadFile(bucket, path, file) {
  const dbCompat = getSupabase();
  return await dbCompat.storage.from(bucket).upload(path, file);
}

export function getFileUrl(bucket, path) {
  const dbCompat = getSupabase();
  const { publicUrl } = dbCompat.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// ── IP CAPTURE ──
export async function captureIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    return ip;
  } catch(e) { return 'unknown'; }
}

// ── LOG LOGIN ──
export async function logLogin(userId, success = true) {
  const ip = await captureIP();
  return dbInsert('login_logs', {
    user_id: userId,
    ip_address: ip,
    user_agent: navigator.userAgent,
    success: success,
    timestamp: new Date().toISOString()
  });
}

// ── LOG ADMIN ACTION ──
export async function logAdminAction(adminId, action, entityType, entityId, oldValue = null, newValue = null) {
  const ip = await captureIP();
  return dbInsert('admin_logs', {
    admin_id: adminId,
    action, entity_type: entityType, entity_id: entityId,
    old_value: oldValue ? JSON.stringify(oldValue) : null,
    new_value: newValue ? JSON.stringify(newValue) : null,
    ip_address: ip,
    timestamp: new Date().toISOString()
  });
}
