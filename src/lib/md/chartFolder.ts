const DB_NAME = "mdce-folder";
const STORE = "dir";
const KEY = "chart";

type Picker = (options: { mode: "readwrite"; id: string }) => Promise<FileSystemDirectoryHandle>;

let linked: FileSystemDirectoryHandle | null = null;

function picker(): Picker | null {
  const fn = (window as Window & { showDirectoryPicker?: Picker }).showDirectoryPicker;
  return fn ? fn.bind(window) : null;
}

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

async function remember(dir: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dir, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function stored(): Promise<FileSystemDirectoryHandle | null> {
  if (linked) return linked;
  const db = await openDb();
  const dir = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  linked = dir ?? null;
  return linked;
}

export async function linkChartFolder(): Promise<string | null> {
  const open = picker();
  if (!open) return null;
  const dir = await open({ mode: "readwrite", id: "mdce-chart" });
  linked = dir;
  await remember(dir).catch(() => undefined);
  return dir.name;
}

export async function writeChartFile(name: string, text: string): Promise<"wrote" | "missing" | "denied" | "unsupported"> {
  if (!picker()) return "unsupported";
  const dir = await stored().catch(() => null);
  if (!dir) return "missing";
  const ask = (dir as FileSystemDirectoryHandle & { requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }).requestPermission;
  if (ask) {
    const perm = await ask.call(dir, { mode: "readwrite" });
    if (perm !== "granted") return "denied";
  }
  const file = await dir.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  await stream.write(text);
  await stream.close();
  return "wrote";
}
