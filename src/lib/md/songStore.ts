const DB_NAME = "mdce";
const STORE = "song";
const KEY = "current";

type SavedSong = { name: string; type: string; blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rememberSong(file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ name: file.name, type: file.type, blob: file } satisfies SavedSong, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function savedSong(): Promise<File | null> {
  const db = await openDb();
  const row = await new Promise<SavedSong | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as SavedSong | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!row?.blob) return null;
  return new File([row.blob], row.name || "song", { type: row.type || row.blob.type });
}
