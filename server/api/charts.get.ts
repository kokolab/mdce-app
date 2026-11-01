import { readdir } from "node:fs/promises";
import { join } from "node:path";

function chartRoot(): string | null {
  const root = process.env.CHART_ROOT?.trim();
  return root || null;
}

export default async function chartsGet() {
  const root = chartRoot();
  if (!root) return { enabled: false, folders: [] as string[] };
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    return { enabled: true, folders, root: join(root) };
  } catch {
    return { enabled: false, folders: [] as string[] };
  }
}
