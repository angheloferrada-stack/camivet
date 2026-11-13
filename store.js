// Capa de almacenamiento.
// - Sin configurar Firebase: modo prueba, todo queda en este dispositivo (IndexedDB).
// - Con Firebase configurado (firebase-config.js): nube (Firestore + Storage) con login.
// La app nunca borra de verdad: "eliminar" solo marca el registro como eliminado.

const COLS = ['clinics', 'patients', 'exams', 'files'];

export async function createStore() {
  let cfg = null;
  try { cfg = (await import('./firebase-config.js')).firebaseConfig; } catch (e) { /* sin config */ }
  return cfg && cfg.apiKey ? cloud(cfg) : local();
}

/* ---------------- Modo prueba (local) ---------------- */
function local() {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('fichasvet-local', 1);
    r.onupgradeneeded = () => [...COLS, 'blobs'].forEach((c) => r.result.createObjectStore(c, { keyPath: 'id' }));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const dbp = open();
  const tx = async (name, mode, fn) => {
    const d = await dbp;
    return new Promise((res, rej) => {
      const t = d.transaction(name, mode);
      const q = fn(t.objectStore(name));
      t.oncomplete = () => res(q && q.result);
      t.onerror = () => rej(t.error);
    });
  };
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ok */ }
  return {
    mode: 'local',
    user: async () => ({ local: true }),
    login: async () => ({ local: true }),
    logout: async () => {},
    all: (n) => tx(n, 'readonly', (s) => s.getAll()),
    put: (n, o) => tx(n, 'readwrite', (s) => s.put(o)),
    putFile: async (meta, blob) => { await tx('blobs', 'readwrite', (s) => s.put({ id: meta.id, blob })); },
    fileURL: async (m) => {
      const r = await tx('blobs', 'readonly', (s) => s.get(m.id));
      return URL.createObjectURL(r.blob);
    },
  };
}

/* ---------------- Nube (Firebase) ---------------- */
async function cloud(cfg) {
  const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const [{ initializeApp }, A, F, S] = await Promise.all([
    import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'),
    import(V + 'firebase-firestore.js'), import(V + 'firebase-storage.js'),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  // Caché local: se puede abrir sin internet y los cambios se sincronizan al volver.
  const fs = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  const st = S.getStorage(app);
  let user = null;
  const safe = (s) => s.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  return {
    mode: 'cloud',
    user: () => new Promise((res) => {
      const un = A.onAuthStateChanged(auth, (u) => { un(); user = u; res(u); });
    }),
    login: async (email, pass) => { user = (await A.signInWithEmailAndPassword(auth, email, pass)).user; return user; },
    logout: () => A.signOut(auth),
    all: async (n) => (await F.getDocs(F.collection(fs, 'users', user.uid, n))).docs.map((d) => d.data()),
    put: (n, o) => F.setDoc(F.doc(fs, 'users', user.uid, n, o.id), o),
    putFile: async (meta, blob) => {
      const path = `users/${user.uid}/files/${meta.id}-${safe(meta.name)}`;
      await S.uploadBytes(S.ref(st, path), blob, { contentType: meta.mime });
      meta.path = path;
    },
    fileURL: (m) => S.getDownloadURL(S.ref(st, m.path)),
  };
}
