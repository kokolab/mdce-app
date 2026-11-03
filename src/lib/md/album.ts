import { unzipSync } from "fflate";

export type AlbumChart = { name: string; text: string };

export type AlbumPack = {
  charts: AlbumChart[];
  bmsName: string;
  bmsText: string;
  infoText: string | null;
  music: File | null;
};

function baseName(path: string): string {
  return path.split(/[/\\]/).pop()?.toLowerCase() ?? path.toLowerCase();
}

function bmsRank(path: string): number {
  const name = baseName(path);
  if (name === "map2.bms") return 0;
  if (name === "map.bms") return 1;
  if (/^map\d+\.bms$/.test(name)) return 2;
  if (name.endsWith(".bms") || name.endsWith(".bme") || name.endsWith(".bml")) return 3;
  return 9;
}

function musicRank(path: string): number {
  const name = baseName(path);
  if (!/\.(ogg|mp3|wav|flac|m4a)$/.test(name)) return 9;
  if (/^music\./.test(name)) return 0;
  if (/^(song|bgm|audio|track)\./.test(name)) return 1;
  if (/^demo\./.test(name)) return 4;
  return 2;
}

function audioType(name: string): string {
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".flac")) return "audio/flac";
  if (name.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

/** Map map1–map4 to Easy/Hard/Master/Hidden; append level when known. */
export function chartLabel(
  name: string,
  levels?: Partial<Record<"difficulty1" | "difficulty2" | "difficulty3" | "difficulty4", string>>,
): string {
  const file = name.toLowerCase();
  const levelOf = (key: "difficulty1" | "difficulty2" | "difficulty3" | "difficulty4") => {
    const raw = levels?.[key]?.trim();
    if (!raw || raw === "0") return "";
    return ` ${raw}`;
  };
  if (file === "map1.bms") return `Easy${levelOf("difficulty1")} · map1`;
  if (file === "map2.bms") return `Hard${levelOf("difficulty2")} · map2`;
  if (file === "map3.bms") return `Master${levelOf("difficulty3")} · map3`;
  if (file === "map4.bms") return `Hidden${levelOf("difficulty4")} · map4`;
  return name;
}

export async function readAlbum(file: File): Promise<AlbumPack | null> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return null;
  }
  const paths = Object.keys(entries);
  const charts = paths.filter((path) => bmsRank(path) < 9).sort((a, b) => bmsRank(a) - bmsRank(b) || baseName(a).localeCompare(baseName(b)));
  if (!charts.length) return null;
  const decoder = new TextDecoder("utf-8");
  const packed = charts.map((path) => ({ name: baseName(path), text: decoder.decode(entries[path]) }));
  const songs = paths.filter((path) => musicRank(path) < 9).sort((a, b) => musicRank(a) - musicRank(b));
  const infoPath = paths.find((path) => baseName(path) === "info.json");
  const musicPath = songs[0];
  const musicName = musicPath ? baseName(musicPath) : "";
  const musicBytes = musicPath ? entries[musicPath] : undefined;
  const music =
    musicBytes && musicName
      ? new File([Uint8Array.from(musicBytes)], musicName, { type: audioType(musicName) })
      : null;
  return {
    charts: packed,
    bmsName: packed[0].name,
    bmsText: packed[0].text,
    infoText: infoPath ? decoder.decode(entries[infoPath]) : null,
    music,
  };
}
