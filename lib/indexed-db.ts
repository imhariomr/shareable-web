const DB_NAME = "sendvia-files";
const DB_VERSION = 1;
const META_STORE = "meta";
const BLOB_STORE = "blobs";

export interface PersistedFileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReceivedFile(meta: PersistedFileMeta, blob: Blob): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
      tx.objectStore(META_STORE).put(meta);
      tx.objectStore(BLOB_STORE).put({ id: meta.id, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getAllPersistedMeta(): Promise<PersistedFileMeta[]> {
  const db = await openDatabase();
  try {
    return await new Promise<PersistedFileMeta[]>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const request = tx.objectStore(META_STORE).getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function getPersistedBlob(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, "readonly");
      const request = tx.objectStore(BLOB_STORE).get(id);
      request.onsuccess = () => resolve(request.result?.blob);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function deletePersistedFile(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
      tx.objectStore(META_STORE).delete(id);
      tx.objectStore(BLOB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearAllPersistedFiles(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
      tx.objectStore(META_STORE).clear();
      tx.objectStore(BLOB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
