import {
  HOLD_KEYS,
  LANE_BY_ID,
  NOTE_BY_KEY,
  WAV_HEADER,
  SCENES,
  channelFor,
  normalizeScene,
  noteName,
  placementForChannel,
  sceneFromNotes,
  type LaneId,
} from "./catalog";
import { locate, measureStart, measureTicks, type Sig, type StopPoint } from "./timing";

export type ChartNote = {
  id: string;
  lane: LaneId;
  key: string;
  tick: number;
  endTick?: number;
  tapHold?: boolean;
  blood?: boolean;
  bpm?: number;
};

export type Meta = {
  title: string;
  artist: string;
  designer: string;
  genre: string;
  bpm: number;
  playlevel: string;
  rank: string;
  player: string;
  chartDifficulty: "easy" | "hard" | "master" | "hidden" | "";
  noteSpeed: string;
  difficulty1: string;
  difficulty2: string;
  difficulty3: string;
  difficulty4: string;
  unlockLevel: string;
  tags: string;
};

export type RawEvent = { measure: number; channel: string; data: string };

export type BmsChart = {
  meta: Meta;
  notes: ChartNote[];
  sigs: Sig[];
  extras: RawEvent[];
  wavExtra: { key: string; name: string }[];
  wavNames: Record<string, string>;
  headerExtras: string[];
  bpmTable: Record<string, number>;
  measureCount: number;
};

export const EMPTY_META: Meta = {
  title: "Untitled",
  artist: "",
  designer: "Kokomilk",
  genre: "scene_01",
  bpm: 120,
  playlevel: "1",
  rank: "1",
  player: "3",
  chartDifficulty: "hard",
  noteSpeed: "3",
  difficulty1: "0",
  difficulty2: "1",
  difficulty3: "0",
  difficulty4: "0",
  unlockLevel: "0",
  tags: "",
};

let seq = 1;
export function nextId(): string {
  seq += 1;
  return `n${seq}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function compress(tokens: string[]): string[] {
  if (tokens.every((token) => token === "00")) return [];
  let step = tokens.length;
  tokens.forEach((token, index) => {
    if (token !== "00") step = gcd(step, index);
  });
  if (step <= 1) return tokens;
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += step) out.push(tokens[i] ?? "00");
  return out;
}

type RawHit = {
  lane: LaneId;
  key: string;
  tick: number;
  blood: boolean;
  long: boolean;
  tapHold: boolean;
  bpm?: number;
};

export function difficultyFromValue(value: string): Meta["chartDifficulty"] {
  const text = value.trim().toLowerCase().replace(/^:/, "");
  if (text === "1" || text === "easy" || text === "beginner") return "easy";
  if (text === "3" || text === "master" || text === "hyper") return "master";
  if (text === "4" || text === "5" || text === "hidden" || text === "another" || text === "insane") return "hidden";
  if (text === "2" || text === "hard" || text === "normal") return "hard";
  return "";
}

export function difficultyFromName(name?: string): Exclude<Meta["chartDifficulty"], ""> {
  const text = (name ?? "").toLowerCase();
  if (/map1|\beasy\b|beginner/.test(text)) return "easy";
  if (/map3|\bmaster\b|hyper/.test(text)) return "master";
  if (/map4|\bhidden\b|another/.test(text)) return "hidden";
  return "hard";
}

const DIFFICULTY_CODE: Record<Exclude<Meta["chartDifficulty"], "">, string> = {
  easy: "1",
  hard: "2",
  master: "3",
  hidden: "4",
};

function padMeasure(measure: number): string {
  return String(measure).padStart(3, "0");
}

function wavToken(key: string): string {
  const clean = key.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (clean.length >= 2) return clean.slice(0, 2);
  return clean.padStart(2, "0");
}

/** Put a note in this measure without erasing one that already occupies the cell. */
function placeToken(tokens: string[], local: number, key: string) {
  const id = wavToken(key);
  const last = tokens.length - 1;
  let at = Math.max(0, Math.min(last, local));
  if (tokens[at] !== "00") {
    for (let step = 1; step < tokens.length; step++) {
      if (at + step <= last && tokens[at + step] === "00") {
        at += step;
        break;
      }
      if (at - step >= 0 && tokens[at - step] === "00") {
        at -= step;
        break;
      }
    }
  }
  tokens[at] = id;
}

export function declaredScene(text: string): string | null {
  const match = text.replace(/^\uFEFF/, "").match(/^#GENRE[ \t]+(.+)$/im);
  if (!match) return null;
  const genre = normalizeScene(match[1].trim());
  return SCENES.some((scene) => scene.id === genre) ? genre : null;
}

export function parseBms(text: string): BmsChart {
  const meta: Meta = { ...EMPTY_META, chartDifficulty: "", noteSpeed: "" };
  const sigs: Sig[] = [];
  const extras: RawEvent[] = [];
  const headerExtras: string[] = [];
  const wav = new Map<string, string>();
  const bpmTable: Record<string, number> = {};
  const dataLines: { measure: number; channel: string; data: string }[] = [];
  let maxMeasure = 0;

  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let genreSet = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("*") || line.startsWith("//") || !line.startsWith("#")) continue;

    const wavMatch = /^#WAV([0-9A-Za-z]{2})\s+(.+)$/i.exec(line);
    if (wavMatch) {
      wav.set(wavMatch[1].toUpperCase(), wavMatch[2].trim());
      continue;
    }
    const bpmMatch = /^#BPM([0-9A-Za-z]{2})\s+(.+)$/i.exec(line);
    if (bpmMatch) {
      const value = Number(bpmMatch[2]);
      if (Number.isFinite(value)) bpmTable[bpmMatch[1].toUpperCase()] = value;
      continue;
    }
    const dataMatch = /^#(\d{3})([0-9A-Za-z]{2}):(.*)$/.exec(line);
    if (dataMatch) {
      const measure = Number(dataMatch[1]);
      const channel = dataMatch[2].toUpperCase();
      const data = dataMatch[3].trim();
      maxMeasure = Math.max(maxMeasure, measure);
      dataLines.push({ measure, channel, data });
      if (channel === "02") {
        const ratio = Number(data);
        if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 0.0001) sigs.push({ measure, ratio });
      }
      continue;
    }

    const header = /^#([A-Za-z]+)\s*(.*)$/.exec(line);
    if (!header) continue;
    const cmd = header[1].toUpperCase();
    const value = header[2].trim();
    if (cmd === "TITLE") meta.title = value;
    else if (cmd === "ARTIST") meta.artist = value;
    else if (cmd === "GENRE") {
      if (value) {
        meta.genre = value;
        genreSet = true;
      }
    } else if (cmd === "LEVELDESIGN") meta.designer = value;
    else if (cmd === "BPM") {
      const bpm = Number(value);
      if (Number.isFinite(bpm) && bpm > 0) meta.bpm = bpm;
    } else if (cmd === "PLAYLEVEL") meta.playlevel = value || meta.playlevel;
    else if (cmd === "RANK") meta.rank = value || meta.rank;
    else if (cmd === "PLAYER") meta.player = value || meta.player;
    else if (cmd === "DIFFICULTY") meta.chartDifficulty = difficultyFromValue(value);
    else if (cmd === "NOTESPEED") meta.noteSpeed = speedLevel(value);
    else if (cmd !== "LNTYPE" && cmd !== "DIFFICULTY" && cmd !== "NOTESPEED") headerExtras.push(line);
  }

  const hits: RawHit[] = [];
  for (const row of dataLines) {
    if (row.channel === "02") continue;
    const placement = placementForChannel(row.channel);
    if (!placement || row.data.length < 2 || row.data.length % 2 !== 0) {
      extras.push(row);
      continue;
    }
    const mt = measureTicks(row.measure, sigs);
    const start = measureStart(row.measure, sigs);
    const parts = row.data.match(/.{2}/g) ?? [];
    parts.forEach((key, index) => {
      const id = key.toUpperCase();
      if (id === "00") return;
      const local = Math.round((index / parts.length) * mt);
      const tick = start + Math.min(Math.max(mt - 1, 0), local);
      if (placement.lane === "bpm") {
        const bpm = placement.bpmLookup ? (bpmTable[id] ?? Number(id)) : Number.parseInt(id, 16);
        if (Number.isFinite(bpm) && bpm > 0) {
          hits.push({ lane: "bpm", key: id, tick, blood: false, long: false, tapHold: false, bpm });
        }
        return;
      }
      hits.push({
        lane: placement.lane,
        key: id,
        tick,
        blood: placement.blood,
        long: placement.long,
        tapHold: placement.tapHold,
      });
    });
  }

  const knownWav = new Set(WAV_HEADER.map((item) => item.key));
  const wavExtra = [...wav.entries()]
    .filter(([key]) => !knownWav.has(key))
    .map(([key, name]) => ({ key, name }));
  const notes = pairHits(hits).filter((note) => {
    if (note.tick > 0 || !isStartingSpeed(note.key)) return true;
    if (!meta.noteSpeed) meta.noteSpeed = speedLevel(note.key);
    return false;
  });
  const written = genreSet ? normalizeScene(meta.genre) : "";
  const known = SCENES.some((scene) => scene.id === written);
  meta.genre = known ? written : (sceneFromNotes(notes) ?? (written || "scene_01"));

  return {
    meta,
    notes,
    sigs,
    extras,
    wavExtra,
    wavNames: Object.fromEntries(wav),
    headerExtras,
    bpmTable,
    measureCount: Math.max(16, maxMeasure + 9),
  };
}

function isStartingSpeed(key: string): boolean {
  const id = key.trim().toUpperCase();
  return id === "0O" || id === "0P" || id === "0Q";
}

function defaultSpeedKey(level: string): string {
  if (level === "1") return "0O";
  if (level === "2") return "0P";
  if (level === "3") return "0Q";
  return "";
}

function speedLevel(value: string): string {
  const text = value.trim().toUpperCase();
  if (text === "1" || text === "0O" || text === "0R" || text === "0U") return "1";
  if (text === "2" || text === "0P" || text === "0S" || text === "0V") return "2";
  if (text === "3" || text === "0Q" || text === "0T" || text === "0W") return "3";
  return "";
}

function pairHits(hits: RawHit[]): ChartNote[] {
  const notes: ChartNote[] = [];
  const groups = new Map<string, RawHit[]>();
  for (const hit of hits) {
    if (hit.lane === "bpm") {
      notes.push({ id: nextId(), lane: "bpm", key: "BPM", tick: hit.tick, bpm: hit.bpm });
      continue;
    }
    if (!hit.long || hit.tapHold) {
      notes.push({
        id: nextId(),
        lane: hit.lane,
        key: hit.key,
        tick: hit.tick,
        blood: hit.blood || undefined,
        tapHold: hit.tapHold || undefined,
      });
      continue;
    }
    const bucket = `${hit.lane}|${hit.key}|${hit.long ? "L" : "S"}|${hit.blood ? "B" : ""}`;
    const list = groups.get(bucket) ?? [];
    list.push(hit);
    groups.set(bucket, list);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.tick - b.tick);
    for (let i = 0; i < list.length; i += 2) {
      const start = list[i];
      const end = list[i + 1];
      notes.push({
        id: nextId(),
        lane: start.lane,
        key: start.key,
        tick: start.tick,
        endTick: end && end.tick > start.tick ? end.tick : undefined,
        blood: start.blood || undefined,
      });
    }
  }
  notes.sort((a, b) => a.tick - b.tick || a.lane.localeCompare(b.lane));
  return notes;
}

function pushHit(
  buckets: Map<string, { measure: number; channel: string; local: number; key: string }[]>,
  sigs: Sig[],
  tick: number,
  channel: string,
  key: string,
) {
  const spot = locate(tick, sigs, 1);
  const id = `${spot.measure}:${channel}`;
  const list = buckets.get(id) ?? [];
  let local = Math.round(spot.local);
  if (local >= spot.len) local = Math.max(0, spot.len - 1);
  while (list.some((item) => item.local === local) && local < spot.len - 1) local += 1;
  list.push({ measure: spot.measure, channel, local, key });
  buckets.set(id, list);
}

export function serializeBms(
  chart: Pick<BmsChart, "meta" | "notes" | "sigs" | "extras" | "wavExtra" | "headerExtras"> &
    Partial<Pick<BmsChart, "wavNames" | "measureCount">>,
): string {
  const { meta, notes, sigs, extras, wavExtra, headerExtras } = chart;
  const lastMeasure = Math.max(
    0,
    ...notes.map((note) => locate(note.endTick ?? note.tick, sigs, 0).measure),
    ...sigs.map((sig) => sig.measure),
    ...extras.map((extra) => extra.measure),
    Math.max(0, (chart.measureCount ?? 1) - 1),
  );
  const lines: string[] = [
    "*---------------------- HEADER FIELD",
    `#PLAYER ${meta.player || "3"}`,
    `#GENRE ${meta.genre}`,
    `#TITLE ${meta.title}`,
    `#ARTIST ${meta.artist}`,
    `#LEVELDESIGN ${meta.designer}`,
    `#BPM ${Math.round(meta.bpm)}`,
    `#PLAYLEVEL ${meta.playlevel || "1"}`,
    `#RANK ${meta.rank || "1"}`,
    `#DIFFICULTY ${DIFFICULTY_CODE[meta.chartDifficulty || "hard"]}`,
    "#LNTYPE 1",
    ...headerExtras.filter((line) => !/^#(DIFFICULTY|NOTESPEED)\b/i.test(line.trim())),
  ];

  const wavs = new Map<string, string>();
  for (const item of WAV_HEADER) wavs.set(item.key, item.name);
  for (const [key, name] of Object.entries(chart.wavNames ?? {})) {
    if (key && name) wavs.set(key.toUpperCase(), name);
  }
  for (const item of wavExtra) wavs.set(item.key.toUpperCase(), item.name);
  for (const [key, name] of wavs) lines.push(`#WAV${key} ${name}`);

  const speedKey = defaultSpeedKey(meta.noteSpeed);
  const writtenNotes = notes.filter((note) => !(note.tick <= 0 && isStartingSpeed(note.key)));
  if (speedKey) writtenNotes.unshift({ id: "default-speed", lane: "boss", key: speedKey, tick: 0 });

  const bpmIndex = new Map<number, string>();
  let bpmSeq = 1;
  for (const note of writtenNotes) {
    if (note.lane !== "bpm" || !note.bpm || note.bpm <= 255 || bpmIndex.has(note.bpm)) continue;
    const id = bpmSeq.toString(36).toUpperCase().padStart(2, "0");
    bpmSeq += 1;
    bpmIndex.set(note.bpm, id);
    lines.push(`#BPM${id} ${note.bpm}`);
  }

  lines.push("", "*---------------------- MAIN DATA FIELD", "");

  const buckets = new Map<string, { measure: number; channel: string; local: number; key: string }[]>();
  for (const note of writtenNotes) {
    if (note.lane === "bpm" && note.bpm) {
      const key =
        note.bpm > 255
          ? (bpmIndex.get(note.bpm) ?? "01")
          : Math.round(note.bpm).toString(16).toUpperCase().padStart(2, "0");
      pushHit(buckets, sigs, note.tick, channelFor(note), key);
      continue;
    }
    const channel = channelFor(note);
    pushHit(buckets, sigs, note.tick, channel, note.key);
    if (note.endTick != null && note.endTick > note.tick && !note.tapHold) {
      pushHit(buckets, sigs, note.endTick, channel, note.key);
    }
  }

  const written = new Set<string>();
  const sigMap = new Map(sigs.map((sig) => [sig.measure, sig.ratio]));
  for (let measure = 0; measure <= lastMeasure; measure++) {
    const ratio = sigMap.get(measure);
    if (ratio && Math.abs(ratio - 1) > 0.0001) lines.push(`#${padMeasure(measure)}02:${trimNum(ratio)}`);
    const channels = [...buckets.keys()]
      .filter((id) => id.startsWith(`${measure}:`))
      .map((id) => id.slice(id.indexOf(":") + 1))
      .sort();
    for (const channel of channels) {
      const list = buckets.get(`${measure}:${channel}`);
      if (!list?.length) continue;
      const len = measureTicks(measure, sigs);
      const tokens = Array.from({ length: len }, () => "00");
      const used = [...list].sort((a, b) => a.local - b.local || a.key.localeCompare(b.key));
      for (const hit of used) placeToken(tokens, hit.local, hit.key);
      const body = compress(tokens).join("");
      if (body) {
        lines.push(`#${padMeasure(measure)}${channel}:${body}`);
        written.add(`${measure}:${channel.toUpperCase()}`);
      }
    }
  }

  for (const extra of extras) {
    if (written.has(`${extra.measure}:${extra.channel.toUpperCase()}`)) continue;
    lines.push(`#${padMeasure(extra.measure)}${extra.channel}:${extra.data}`);
  }
  lines.push("");
  return lines.join("\r\n");
}

function trimNum(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** BMS #STOP lengths are in 1/192 of a measure. Channel 09 points at that table. */
export function stopPoints(headerExtras: string[], extras: RawEvent[], sigs: Sig[]): StopPoint[] {
  const table = new Map<string, number>();
  for (const line of headerExtras) {
    const match = /^#STOP([0-9A-Za-z]{2})\s+(.+)$/i.exec(line.trim());
    if (!match) continue;
    const value = Number(match[2]);
    if (Number.isFinite(value) && value > 0) table.set(match[1].toUpperCase(), value);
  }
  if (!table.size) return [];
  const stops: StopPoint[] = [];
  for (const row of extras) {
    if (row.channel !== "09") continue;
    const mt = measureTicks(row.measure, sigs);
    const start = measureStart(row.measure, sigs);
    const parts = row.data.match(/.{2}/g) ?? [];
    parts.forEach((key, index) => {
      const units = table.get(key.toUpperCase());
      if (!units) return;
      const local = Math.round((index / parts.length) * mt);
      stops.push({ tick: start + Math.min(mt - 1, Math.max(0, local)), units });
    });
  }
  stops.sort((a, b) => a.tick - b.tick || a.units - b.units);
  return stops;
}

export function musicFileName(wavNames: Record<string, string>, notes: { lane: string; key: string }[]): string | null {
  const keys = ["10", ...notes.filter((note) => note.lane === "bgm").map((note) => note.key)];
  for (const key of keys) {
    const name = wavNames[key.toUpperCase()] ?? wavNames[key];
    const file = fileTail(name);
    if (file) return file;
  }
  for (const name of Object.values(wavNames)) {
    const file = fileTail(name);
    if (file) return file;
  }
  return null;
}

function fileTail(name: string | undefined): string | null {
  if (!name || !/\.(ogg|mp3|wav|flac|m4a)$/i.test(name)) return null;
  return name.split(/[/\\]/).pop() ?? null;
}

let loadedInfo: Record<string, unknown> | null = null;

/** Keep the info.json that was opened so per-difficulty designers can be restored. */
export function rememberInfo(data: Record<string, unknown> | null) {
  loadedInfo = data;
}

export function infoJson(meta: Meta): string {
  const tags = meta.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const loadedDesigner = (slot: 1 | 2 | 3 | 4): string => {
    const key = `levelDesigner${slot}`;
    const fromFile = loadedInfo?.[key];
    if (typeof fromFile === "string" && fromFile) return fromFile;
    return meta.designer;
  };

  // Custom Albums schema only — no name_romanized / hideBms* fields.
  const file: Record<string, unknown> = {
    name: meta.title,
    author: meta.artist,
    bpm: String(Math.round(meta.bpm)),
    scene: meta.genre || "scene_01",
    searchTags: tags,
    levelDesigner: meta.designer,
    levelDesigner1: loadedDesigner(1),
    levelDesigner2: loadedDesigner(2),
    levelDesigner3: loadedDesigner(3),
    levelDesigner4: loadedDesigner(4),
    difficulty1: meta.difficulty1 || "0",
    difficulty2: meta.difficulty2 || "0",
    difficulty3: meta.difficulty3 || "0",
    difficulty4: meta.difficulty4 || "0",
    unlockLevel: meta.unlockLevel || "0",
  };

  // 2-space indent; keep searchTags on one line.
  const lines: string[] = ["{"];
  const entries = Object.entries(file);
  entries.forEach(([key, value], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    if (key === "searchTags") {
      lines.push(`  "searchTags": ${JSON.stringify(value)}${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
    }
  });
  lines.push("}");
  return lines.join("\n");
}

export type ChartIssue = {
  text: string;
  ids: string[];
  tick: number;
};

function where(notes: ChartNote[], sigs: Sig[]): string {
  const seen = new Set<string>();
  const spots: string[] = [];
  for (const note of [...notes].sort((a, b) => a.tick - b.tick)) {
    const bar = String(locate(note.tick, sigs, 1).measure).padStart(3, "0");
    const lane = LANE_BY_ID[note.lane]?.label ?? note.lane.toUpperCase();
    const spot = `${bar} ${lane}`;
    if (seen.has(spot)) continue;
    seen.add(spot);
    spots.push(spot);
  }
  if (!spots.length) return "";
  const shown = spots.slice(0, 3).join(", ");
  return spots.length > 3 ? `${shown} +${spots.length - 3}` : shown;
}

function issue(text: string, notes: ChartNote[], sigs: Sig[]): ChartIssue {
  const sorted = [...notes].sort((a, b) => a.tick - b.tick);
  const place = where(sorted, sigs);
  return {
    text: place ? `${text} · ${place}` : text,
    ids: sorted.map((note) => note.id),
    tick: sorted[0]?.tick ?? 0,
  };
}

export function chartIssues(notes: ChartNote[], sigs: Sig[] = []): ChartIssue[] {
  const issues: ChartIssue[] = [];
  const gems = notes.filter((note) => note.key === "0E");
  const unpaired = gems.filter((gem) => {
    const partner =
      gem.lane === "air" ? "gnd" : gem.lane === "gnd" ? "air" : gem.lane === "air2" ? "gnd2" : gem.lane === "gnd2" ? "air2" : null;
    return !partner || !gems.some((other) => other !== gem && other.lane === partner && Math.abs(other.tick - gem.tick) <= 1);
  });
  if (unpaired.length) issues.push(issue(`${unpaired.length} gemini without a partner`, unpaired, sigs));
  const airGears = notes.filter((note) => note.key === "0H" && (note.lane === "air" || note.lane === "air2"));
  if (airGears.length) issues.push(issue(`${airGears.length} gear on an air lane`, airGears, sigs));
  const phase1 = notes.filter((note) => note.key === "13");
  const phase2 = notes.filter((note) => note.key === "14" || note.key === "15");
  if (phase1.length && phase2.length) issues.push(issue("Boss shot 1 is mixed with phase-2 shots", [...phase1, ...phase2], sigs));
  const openHolds = notes.filter((note) => HOLD_KEYS.has(note.key) && note.endTick == null && !note.tapHold);
  if (openHolds.length) issues.push(issue(`${openHolds.length} hold without an end`, openHolds, sigs));
  return issues;
}

export function describeNote(note: ChartNote): string {
  if (note.lane === "bpm") return `${Math.round(note.bpm ?? 0)} BPM`;
  const flags = [note.tapHold ? "tap hold" : "", note.blood ? "heart enemy" : ""].filter(Boolean);
  const name = noteName(note.key);
  return flags.length ? `${name} · ${flags.join(", ")}` : name;
}

export function isKnownKey(key: string): boolean {
  return Boolean(NOTE_BY_KEY[key]) || key === "BPM";
}
