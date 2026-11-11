/* On-device photo gallery stored in IndexedDB (falls back to memory if unavailable). */

const DB_NAME = 'magic-pose';
const STORE = 'photos';
let dbPromise = null;
const memory = new Map();
let memoryId = 0;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('createdAt', 'createdAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * @param {{blob: Blob, kind: 'photo'|'ai'|'preview'|'original', title?: string, templateId?: string, width?: number, height?: number}} item
 * @returns {Promise<object>} the stored record (with id)
 */
export async function addPhoto(item) {
  const record = { ...item, createdAt: Date.now() };
  const db = await openDb();
  if (!db) {
    record.id = ++memoryId;
    memory.set(record.id, record);
    return record;
  }
  record.id = await tx(db, 'readwrite', (s) => s.add(record));
  return record;
}

export async function updatePhoto(id, changes) {
  const db = await openDb();
  if (!db) {
    const r = memory.get(id);
    if (r) Object.assign(r, changes);
    return r;
  }
  const current = await tx(db, 'readonly', (s) => s.get(id));
  if (!current) return null;
  const next = { ...current, ...changes, id };
  await tx(db, 'readwrite', (s) => s.put(next));
  return next;
}

export async function listPhotos() {
  const db = await openDb();
  const all = db ? await tx(db, 'readonly', (s) => s.getAll()) : [...memory.values()];
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}

export async function latestPhoto() {
  const all = await listPhotos();
  return all[0] || null;
}

export async function deletePhoto(id) {
  const db = await openDb();
  if (!db) return memory.delete(id);
  await tx(db, 'readwrite', (s) => s.delete(id));
  return true;
}

export async function clearPhotos() {
  const db = await openDb();
  if (!db) return memory.clear();
  await tx(db, 'readwrite', (s) => s.clear());
}

export async function usage() {
  const all = await listPhotos();
  const bytes = all.reduce((n, p) => n + (p.blob ? p.blob.size : 0), 0);
  return { count: all.length, bytes };
}
