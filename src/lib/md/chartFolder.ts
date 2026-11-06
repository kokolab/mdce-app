import type { AlbumChart } from "./album";

const DB_NAME = "mdce-folder";
const STORE = "dir";
const KEY = "chart";
const SYNC_KEY = "mdce-synced-song";

type Picker = (options: { mode: "readwrite"; id: string }) => Promise<FileSystemDirectoryHandle>;

export type WriteResult = "wrote" | "stale" | "missing" | "denied" | "unsupported";

let linked: FileSystemDirectoryHandle | null = null;
let serverEnabled: boolean | null = null;

/** Serialize writes so rapid Ctrl+S only applies the latest content. */
let writeBusy = false;
let pendingWrite: { name: string; text: string } | null = null;
let pendingResolvers: Array<(result: WriteResult) => void> = [];

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

function isBms(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml");
}

function isAudio(name: string): boolean {
  return /\.(ogg|mp3|wav|flac|m4a)$/i.test(name);
}

function bmsOrder(name: string): number {
  const lower = name.toLowerCase();
  if (lower === "map2.bms") return 0;
  if (lower === "map1.bms") return 1;
  if (lower === "map3.bms") return 2;
  if (lower === "map4.bms") return 3;
  if (/^map\d+\.bms$/.test(lower)) return 4;
  return 5;
}

function musicCandidates(wanted: string | null | undefined): string[] {
  const list: string[] = [];
  if (wanted) list.push(wanted);
  for (const name of ["music.ogg", "music.mp3", "music.wav", "music.flac", "music.m4a"]) {
    if (!list.some((item) => item.toLowerCase() === name)) list.push(name);
  }
  return list;
}

export function syncedSongName(): string {
  try {
    return localStorage.getItem(SYNC_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSyncedSongName(name: string): void {
  try {
    if (name) localStorage.setItem(SYNC_KEY, name);
    else localStorage.removeItem(SYNC_KEY);
  } catch {
    /* ignore */
  }
}

/** Desktop shell (Tauri). Charts live in Custom_Albums next to the installed exe. */
function inDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type DesktopStatus = { enabled: boolean; folders: string[]; root?: string };
type DesktopFolder = { charts: AlbumChart[]; music: string[] };
type DesktopFile = { name: string; mime: string; text?: string; base64?: string };
type DesktopWrite = { ok: boolean; verified?: boolean };

async function desktopInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}
export async function clearBrowserLink(): Promise<void> {
  linked = null;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

/** Link a Custom_Albums folder by name via the charts API (no browser picker). */
export async function linkServerFolder(name: string): Promise<boolean> {
  const folder = name.trim();
  if (!folder) return false;
  await clearBrowserLink();
  setSyncedSongName(folder);
  const charts = await listServerCharts(folder);
  return charts.length > 0;
}

export async function serverCharts(): Promise<{ enabled: boolean; folders: string[] }> {
  if (inDesktop()) {
    try {
      const data = await desktopInvoke<DesktopStatus>("charts_status");
      serverEnabled = Boolean(data.enabled);
      return { enabled: Boolean(data.enabled), folders: Array.isArray(data.folders) ? data.folders : [] };
    } catch {
      serverEnabled = false;
      return { enabled: false, folders: [] };
    }
  }
  try {
    const response = await fetch("/api/charts");
    if (!response.ok) {
      serverEnabled = false;
      return { enabled: false, folders: [] };
    }
    const data = (await response.json()) as { enabled?: boolean; folders?: string[] };
    serverEnabled = Boolean(data.enabled);
    return { enabled: Boolean(data.enabled), folders: Array.isArray(data.folders) ? data.folders : [] };
  } catch {
    serverEnabled = false;
    return { enabled: false, folders: [] };
  }
}

async function listBrowserCharts(): Promise<AlbumChart[]> {
  const dir = await stored().catch(() => null);
  if (!dir) return [];
  const ask = (dir as FileSystemDirectoryHandle & { requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }).requestPermission;
  if (ask) {
    const perm = await ask.call(dir, { mode: "readwrite" });
    if (perm !== "granted") return [];
  }
  const charts: AlbumChart[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== "file" || !isBms(name)) continue;
    const file = await handle.getFile();
    charts.push({ name, text: await file.text() });
  }
  return charts.sort((a, b) => bmsOrder(a.name) - bmsOrder(b.name) || a.name.localeCompare(b.name));
}

async function listServerCharts(folder: string): Promise<AlbumChart[]> {
  if (inDesktop()) {
    try {
      const data = await desktopInvoke<DesktopFolder>("charts_folder", { folder });
      const charts = Array.isArray(data.charts) ? data.charts : [];
      return charts
        .filter((chart) => chart && typeof chart.name === "string" && typeof chart.text === "string")
        .sort((a, b) => bmsOrder(a.name) - bmsOrder(b.name) || a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
  try {
    const response = await fetch(`/api/charts?folder=${encodeURIComponent(folder)}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { charts?: AlbumChart[] };
    const charts = Array.isArray(data.charts) ? data.charts : [];
    return charts
      .filter((chart) => chart && typeof chart.name === "string" && typeof chart.text === "string")
      .sort((a, b) => bmsOrder(a.name) - bmsOrder(b.name) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listLinkedCharts(): Promise<AlbumChart[]> {
  const folder = syncedSongName();
  if (folder) {
    const server = await listServerCharts(folder);
    if (server.length) return server;
  }
  return listBrowserCharts();
}

export function pickDefaultChart(charts: AlbumChart[]): AlbumChart | null {
  if (!charts.length) return null;
  return charts.find((chart) => chart.name.toLowerCase() === "map2.bms") ?? charts[0] ?? null;
}

async function browserMusic(wanted: string | null | undefined): Promise<File | null> {
  const dir = await stored().catch(() => null);
  if (!dir) return null;
  const ask = (dir as FileSystemDirectoryHandle & { requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }).requestPermission;
  if (ask) {
    const perm = await ask.call(dir, { mode: "readwrite" });
    if (perm !== "granted") return null;
  }
  const files = new Map<string, FileSystemFileHandle>();
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file" && isAudio(name)) files.set(name.toLowerCase(), handle);
  }
  for (const candidate of musicCandidates(wanted)) {
    const handle = files.get(candidate.toLowerCase());
    if (!handle) continue;
    return handle.getFile();
  }
  if (files.size === 1) {
    const only = files.values().next().value;
    if (only) return only.getFile();
  }
  return null;
}

async function serverMusic(wanted: string | null | undefined): Promise<File | null> {
  const folder = syncedSongName();
  if (!folder) return null;
  if (inDesktop()) {
    try {
      const data = await desktopInvoke<DesktopFolder>("charts_folder", { folder });
      const available = Array.isArray(data.music) ? data.music : [];
      const lowerMap = new Map(available.map((name) => [name.toLowerCase(), name]));
      const tryNames = [...musicCandidates(wanted), ...(available.length === 1 ? available : [])];
      for (const candidate of tryNames) {
        const real = lowerMap.get(candidate.toLowerCase()) ?? (available.includes(candidate) ? candidate : null);
        if (!real) continue;
        const file = await desktopInvoke<DesktopFile>("charts_read", { folder, name: real });
        if (!file.base64) continue;
        const binary = atob(file.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        if (!bytes.byteLength) continue;
        return new File([bytes], real, { type: file.mime || "audio/ogg" });
      }
    } catch {
      return null;
    }
    return null;
  }
  try {
    const listRes = await fetch(`/api/charts?folder=${encodeURIComponent(folder)}`);
    if (!listRes.ok) return null;
    const data = (await listRes.json()) as { music?: string[] };
    const available = Array.isArray(data.music) ? data.music : [];
    const lowerMap = new Map(available.map((name) => [name.toLowerCase(), name]));
    const tryNames = [...musicCandidates(wanted), ...(available.length === 1 ? available : [])];
    for (const candidate of tryNames) {
      const real = lowerMap.get(candidate.toLowerCase()) ?? (available.includes(candidate) ? candidate : null);
      if (!real) continue;
      const response = await fetch(`/api/charts?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(real)}`);
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.size) continue;
      return new File([blob], real, { type: blob.type || "audio/ogg" });
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadLinkedMusic(wanted?: string | null): Promise<File | null> {
  const browser = await browserMusic(wanted);
  if (browser) return browser;
  return serverMusic(wanted);
}

export async function linkChartFolder(): Promise<string | null> {
  const open = picker();
  if (!open) return null;
  const dir = await open({ mode: "readwrite", id: "mdce-chart" });
  linked = dir;
  await remember(dir).catch(() => undefined);
  setSyncedSongName("");
  return dir.name;
}

async function writeBrowser(name: string, text: string): Promise<WriteResult> {
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
  const check = await (await dir.getFileHandle(name)).getFile();
  const onDisk = await check.text();
  return onDisk === text ? "wrote" : "stale";
}

async function writeServer(name: string, text: string): Promise<WriteResult> {
  const folder = syncedSongName();
  if (!folder) return "missing";
  if (inDesktop()) {
    try {
      const data = await desktopInvoke<DesktopWrite>("charts_write", { folder, name, content: text });
      if (!data.ok) return "denied";
      if (data.verified === false) return "stale";
      return "wrote";
    } catch {
      return "denied";
    }
  }
  if (serverEnabled === false) return "unsupported";
  try {
    const response = await fetch("/api/charts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folder, name, content: text }),
    });
    if (response.status === 503) {
      serverEnabled = false;
      return "unsupported";
    }
    if (!response.ok) return "denied";
    const data = (await response.json()) as { ok?: boolean; verified?: boolean };
    if (!data.ok) return "denied";
    if (data.verified === false) return "stale";
    return "wrote";
  } catch {
    return "denied";
  }
}

async function writeOnce(name: string, text: string): Promise<WriteResult> {
  const browser = await writeBrowser(name, text);
  if (browser === "wrote" || browser === "stale" || browser === "denied") return browser;
  if (browser === "missing" && picker()) return "missing";
  return writeServer(name, text);
}

async function flushWrites(): Promise<void> {
  if (writeBusy) return;
  writeBusy = true;
  try {
    while (pendingWrite) {
      const job = pendingWrite;
      pendingWrite = null;
      const resolvers = pendingResolvers;
      pendingResolvers = [];
      let result: WriteResult = "denied";
      try {
        result = await writeOnce(job.name, job.text);
      } catch {
        result = "denied";
      }
      for (const done of resolvers) done(result);
    }
  } finally {
    writeBusy = false;
    if (pendingWrite) void flushWrites();
  }
}

export function writeChartFile(name: string, text: string): Promise<WriteResult> {
  pendingWrite = { name, text };
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
    void flushWrites();
  });
}
