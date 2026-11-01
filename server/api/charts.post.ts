import { mkdir, writeFile } from "node:fs/promises";
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

function allowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === "info.json") return true;
  return /^map[1-4]\.bms$/i.test(name) || /\.bms$/i.test(name);
}

export default async function chartsPost(event: { req: Request }) {
  const root = chartRoot();
  if (!root) {
    return Response.json({ ok: false, error: "CHART_ROOT is not configured" }, { status: 503 });
  }

  let body: { folder?: unknown; name?: unknown; content?: unknown };
  try {
    body = (await event.req.json()) as { folder?: unknown; name?: unknown; content?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const folder = safeName(body.folder);
  const name = safeName(body.name);
  const content = typeof body.content === "string" ? body.content : null;
  if (!folder || !name || content == null) {
    return Response.json({ ok: false, error: "folder, name, and content are required" }, { status: 400 });
  }
  if (!allowedFile(name)) {
    return Response.json({ ok: false, error: "File type not allowed" }, { status: 400 });
  }

  const dir = join(root, folder);
  const target = join(dir, name);
  if (!target.startsWith(join(root, folder)) && !target.startsWith(dir)) {
    return Response.json({ ok: false, error: "Invalid path" }, { status: 400 });
  }

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(target, content, "utf8");
    return { ok: true, path: `${folder}/${name}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Write failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
