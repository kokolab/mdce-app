/** Drop a PNG in src/assets/notes named after the note key, for example 21.png or 0E.png. */

const files = import.meta.glob("../../assets/notes/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const BY_KEY: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const name = path.split("/").pop()?.replace(/\.png$/i, "").toUpperCase();
  if (name) BY_KEY[name] = url;
}

export function customNoteUrl(key: string): string | undefined {
  return BY_KEY[key.toUpperCase()];
}
