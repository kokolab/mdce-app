/** Imported note PNGs stay in this browser. Missing keys use the plain icons. */

const DB = "mdce";
const STORE = "note-icons";

const cache = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function customNoteUrl(key: string): string | undefined {
  return cache.get(key.toUpperCase());
}

export function subscribeCustomNotes(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let loading: Promise<void> | null = null;

export function loadCustomNotes() {
  if (loading || typeof indexedDB === "undefined") return loading ?? Promise.resolve();
  loading = openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            emit();
            resolve();
            return;
          }
          if (typeof cursor.key === "string" && typeof cursor.value === "string") cache.set(cursor.key, cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      }),
  );
  return loading;
}

export async function setCustomNote(key: string, file: Blob) {
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  const url = `data:image/png;base64,${btoa(binary)}`;
  const id = key.toUpperCase();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(url, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  cache.set(id, url);
  emit();
}

export async function clearCustomNote(key: string) {
  const id = key.toUpperCase();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  cache.delete(id);
  emit();
}
