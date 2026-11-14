// Capa de almacenamiento.
// - Sin configurar Firebase: modo prueba, todo queda en este dispositivo (IndexedDB).
// - Con Firebase configurado (firebase-config.js): nube (solo Firestore) con login.
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
    loginGoogle: async () => ({ local: true }),
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
  // Todo vive en Firestore (plan gratis, sin tarjeta). No se usa Cloud Storage.
  const [{ initializeApp }, A, F] = await Promise.all([
    import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  // Caché local: se puede abrir sin internet y los cambios se sincronizan al volver.
  const fs = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  let user = null;
  // Firestore admite ~1 MB por documento: cada archivo se guarda en trozos de 700 KB.
  const CHUNK = 700 * 1024;
  const chunkRef = (id, i) => F.doc(fs, 'users', user.uid, 'filechunks', `${id}_${i}`);
  const timeout = (ms, msg) => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));
  return {
    mode: 'cloud',
    user: () => new Promise((res) => {
      const un = A.onAuthStateChanged(auth, (u) => { un(); user = u; res(u); });
    }),
    login: async (email, pass) => { user = (await A.signInWithEmailAndPassword(auth, email, pass)).user; return user; },
    loginGoogle: async () => { user = (await A.signInWithPopup(auth, new A.GoogleAuthProvider())).user; return user; },
    logout: () => A.signOut(auth),
    all: async (n) => (await F.getDocs(F.collection(fs, 'users', user.uid, n))).docs.map((d) => d.data()),
    put: (n, o) => F.setDoc(F.doc(fs, 'users', user.uid, n, o.id), o),
    // Sube todos los trozos y recién después la app guarda la ficha del archivo: nunca queda un archivo a medias.
    putFile: async (meta, blob) => {
      if (navigator.onLine === false) throw new Error('Sin conexión: para subir archivos necesitas internet.');
      const buf = new Uint8Array(await blob.arrayBuffer());
      const n = Math.max(1, Math.ceil(buf.length / CHUNK));
      for (let i = 0; i < n; i++) {
        const data = F.Bytes.fromUint8Array(buf.slice(i * CHUNK, (i + 1) * CHUNK));
        await Promise.race([F.setDoc(chunkRef(meta.id, i), { fileId: meta.id, i, data }), timeout(60000, 'La subida tardó demasiado.')]);
      }
      meta.chunks = n;
    },
    fileURL: async (m) => {
      const n = m.chunks || 1;
      const docs = await Promise.all(Array.from({ length: n }, (_, i) => F.getDoc(chunkRef(m.id, i))));
      if (docs.some((d) => !d.exists())) throw new Error('Archivo incompleto');
      return URL.createObjectURL(new Blob(docs.map((d) => d.data().data.toUint8Array()), { type: m.mime }));
    },
  };
}
