import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

function chartRoot(): string | null {
  const root = process.env.CHART_ROOT?.trim();
  return root || null;
}

function safeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text === "." || text === "..") return null;
  if (text.includes("/") || text.includes("\\") || text.includes("\0")) return null;
  return text;
}

function isBms(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml");
}

function isAudio(name: string): boolean {
  return /\.(ogg|mp3|wav|flac|m4a)$/i.test(name);
}

function audioType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
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

export default async function chartsGet(event: { req: Request }) {
  const root = chartRoot();
  if (!root) return { enabled: false, folders: [] as string[], charts: [] as { name: string; text: string }[] };

  const url = new URL(event.req.url);
  const folder = safeName(url.searchParams.get("folder"));
  const name = safeName(url.searchParams.get("name"));

  try {
    if (folder && name) {
      const lower = name.toLowerCase();
      const allowed = isBms(name) || lower === "info.json" || isAudio(name);
      if (!allowed) {
        return Response.json({ ok: false, error: "File type not allowed" }, { status: 400 });
      }
      const target = join(root, folder, name);
      if (!target.startsWith(join(root, folder))) {
        return Response.json({ ok: false, error: "Invalid path" }, { status: 400 });
      }
      if (isAudio(name)) {
        const data = await readFile(target);
        return new Response(data, {
          headers: {
            "content-type": audioType(name),
            "cache-control": "no-store",
            "content-disposition": `inline; filename="${name.replace(/"/g, "")}"`,
          },
        });
      }
      const text = await readFile(target, "utf8");
      return { ok: true, name, text };
    }

    if (folder) {
      const dir = join(root, folder);
      if (!dir.startsWith(root)) {
        return Response.json({ ok: false, error: "Invalid path" }, { status: 400 });
      }
      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && isBms(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => bmsOrder(a) - bmsOrder(b) || a.localeCompare(b));
      const music = entries
        .filter((entry) => entry.isFile() && isAudio(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
      const charts: { name: string; text: string }[] = [];
      for (const file of files) {
        const text = await readFile(join(dir, file), "utf8");
        charts.push({ name: file, text });
      }
      return { enabled: true, folder, charts, music };
    }

    const entries = await readdir(root, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    return { enabled: true, folders, root: join(root) };
  } catch (error) {
    if (folder) {
      const message = error instanceof Error ? error.message : "Read failed";
      return Response.json({ ok: false, error: message }, { status: 404 });
    }
    return { enabled: false, folders: [] as string[] };
  }
}
