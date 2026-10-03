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

function imageType(file: Blob, bytes: Uint8Array): string | null {
  const webp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (webp) return "image/webp";
  if (png) return "image/png";
  if (file.type === "image/webp" || file.type === "image/png") return file.type;
  return null;
}

export async function setCustomNote(key: string, file: Blob) {
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  const type = imageType(file, bytes);
  if (!type) return;
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  const url = `data:${type};base64,${btoa(binary)}`;
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
