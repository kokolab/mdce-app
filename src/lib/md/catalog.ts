/** Muse Dash BMS lanes and note keys, matching MDBMSC / CustomAlbums. */

export const TICKS = 192;

export type LaneId = "air" | "air2" | "gnd" | "gnd2" | "boss" | "boss2" | "bgm" | "bpm";

export type LaneTone = "air" | "gnd" | "boss" | "bgm";

export type LaneDef = {
  id: LaneId;
  label: string;
  hint: string;
  /** Decimal BMS channel written for a normal note. */
  base: number;
  /** Tap-hold channel, when the game supports one. */
  tap: string;
  tone: LaneTone;
};

export const LANES: LaneDef[] = [
  { id: "air", label: "AIR", hint: "Upper lane", base: 13, tap: "D3", tone: "air" },
  { id: "air2", label: "AIR 2", hint: "Upper, when AIR is busy", base: 11, tap: "D1", tone: "air" },
  { id: "gnd", label: "GND", hint: "Lower lane", base: 14, tap: "D4", tone: "gnd" },
  { id: "gnd2", label: "GND 2", hint: "Lower, when GND is busy", base: 12, tap: "D2", tone: "gnd" },
  { id: "boss", label: "BOSS", hint: "Boss, speed, scene", base: 15, tap: "", tone: "boss" },
  { id: "boss2", label: "BOSS 2", hint: "Second boss event", base: 18, tap: "", tone: "boss" },
  { id: "bgm", label: "MUSIC", hint: "Song start", base: 1, tap: "", tone: "bgm" },
  { id: "bpm", label: "BPM", hint: "Tempo change", base: 3, tap: "", tone: "bgm" },
];

export const DISPLAY_LANES: LaneId[] = ["bpm", "air2", "gnd2", "air", "gnd", "boss", "boss2", "bgm"];

/** Theme column widths from iBMSC MD. In horizontal view, lane height is this times H. */
export const LANE_UNITS: Record<LaneId, number> = {
  bpm: 15,
  air2: 40,
  gnd2: 40,
  air: 40,
  gnd: 40,
  boss: 80,
  boss2: 80,
  bgm: 50,
};

export const LANE_BY_ID: Record<LaneId, LaneDef> = Object.fromEntries(
  LANES.map((lane) => [lane.id, lane]),
) as Record<LaneId, LaneDef>;

export const PARTNER: Partial<Record<LaneId, LaneId>> = {
  air: "gnd",
  gnd: "air",
  air2: "gnd2",
  gnd2: "air2",
};

const LANE_BY_BASE: Record<number, LaneId> = {
  13: "air",
  11: "air2",
  14: "gnd",
  12: "gnd2",
  15: "boss",
  18: "boss2",
  1: "bgm",
  3: "bpm",
  8: "bpm",
};

const TAP_LANE: Record<string, LaneId> = { D1: "air2", D3: "air", D2: "gnd2", D4: "gnd" };

export type Placement = {
  lane: LaneId;
  blood: boolean;
  long: boolean;
  tapHold: boolean;
  bpmLookup: boolean;
};

export function placementForChannel(channel: string): Placement | null {
  const tap = TAP_LANE[channel.toUpperCase()];
  if (tap) return { lane: tap, blood: false, long: false, tapHold: true, bpmLookup: false };
  if (!/^\d+$/.test(channel)) return null;
  const n = Number(channel);
  const blood = (n >= 30 && n < 50) || (n >= 70 && n < 90);
  const long = n >= 50 && n < 90;
  let base = n;
  if (n >= 70) base = n - 60;
  else if (n >= 50) base = n - 40;
  else if (n >= 30) base = n - 20;
  const lane = LANE_BY_BASE[base];
  if (!lane) return null;
  return { lane, blood, long, tapHold: false, bpmLookup: base === 8 };
}

/** Channels the game actually reads for long notes on the four play lanes. */
const LN_BASES = new Set([11, 12, 13, 14]);

export function channelFor(note: {
  lane: LaneId;
  tapHold?: boolean;
  blood?: boolean;
  endTick?: number;
  bpm?: number;
}): string {
  const lane = LANE_BY_ID[note.lane];
  if (note.lane === "bpm") return (note.bpm ?? 0) > 255 ? "08" : "03";
  if (note.tapHold && lane.tap) return lane.tap;
  let base = lane.base;
  const wantsLength = note.endTick != null && note.lane !== "bgm";
  if (wantsLength && LN_BASES.has(base)) base += 40;
  else if (note.blood && (note.lane === "air" || note.lane === "air2" || note.lane === "gnd" || note.lane === "gnd2"))
    base += 20;
  return String(base).padStart(2, "0");
}

export type NoteGroup = "tap" | "accent" | "hold" | "boss" | "speed" | "item" | "fx";

export type NoteDef = {
  key: string;
  name: string;
  short: string;
  group: NoteGroup;
  hold?: boolean;
  sound?: string;
  dir?: "up" | "down";
};

export const NOTES: NoteDef[] = [
  { key: "01", name: "Small", short: "S", group: "tap", sound: "small" },
  { key: "02", name: "Small up", short: "S+", group: "tap", sound: "small-up", dir: "up" },
  { key: "03", name: "Small down", short: "S-", group: "tap", sound: "small-down", dir: "down" },
  { key: "04", name: "Medium 1", short: "M1", group: "tap", sound: "med1" },
  { key: "05", name: "Medium 1 up", short: "M1+", group: "tap", sound: "med1-up", dir: "up" },
  { key: "06", name: "Medium 1 down", short: "M1-", group: "tap", sound: "med1-down", dir: "down" },
  { key: "07", name: "Medium 2", short: "M2", group: "tap", sound: "med2" },
  { key: "08", name: "Medium 2 up", short: "M2+", group: "tap", sound: "med2-up", dir: "up" },
  { key: "09", name: "Medium 2 down", short: "M2-", group: "tap", sound: "med2-down", dir: "down" },
  { key: "0A", name: "Large 1", short: "L1", group: "accent", sound: "large1" },
  { key: "0B", name: "Large 2", short: "L2", group: "accent", sound: "large2" },
  { key: "0C", name: "Raider", short: "RDR", group: "accent", sound: "raider" },
  { key: "0D", name: "Hammer", short: "HAM", group: "accent", sound: "hammer" },
  { key: "0E", name: "Gemini", short: "GEM", group: "accent", sound: "gemini" },
  { key: "0I", name: "Raider flipped", short: "RDR*", group: "accent", sound: "raider-flip" },
  { key: "0J", name: "Hammer flipped", short: "HAM*", group: "accent", sound: "hammer-flip" },
  { key: "0F", name: "Hold", short: "HOLD", group: "hold", hold: true, sound: "hold" },
  { key: "0G", name: "Masher", short: "MASH", group: "hold", hold: true, sound: "masher" },
  { key: "0H", name: "Gear", short: "GEAR", group: "hold", sound: "gear" },
  { key: "11", name: "Boss melee 1", short: "BM1", group: "boss", sound: "boss-melee1" },
  { key: "12", name: "Boss melee 2", short: "BM2", group: "boss", sound: "boss-melee2" },
  { key: "13", name: "Boss shot 1", short: "BP1", group: "boss", sound: "boss-proj1" },
  { key: "14", name: "Boss shot 2", short: "BP2", group: "boss", sound: "boss-proj2" },
  { key: "15", name: "Boss shot 3", short: "BP3", group: "boss", sound: "boss-proj3" },
  { key: "16", name: "Boss masher 1", short: "BMS1", group: "boss", hold: true, sound: "boss-masher1" },
  { key: "17", name: "Boss masher 2", short: "BMS2", group: "boss", hold: true, sound: "boss-masher2" },
  { key: "18", name: "Boss gear", short: "BGR", group: "boss", sound: "boss-gear" },
  { key: "0O", name: "Speed 1 both", short: "S1", group: "speed" },
  { key: "0P", name: "Speed 2 both", short: "S2", group: "speed" },
  { key: "0Q", name: "Speed 3 both", short: "S3", group: "speed" },
  { key: "0R", name: "Speed 1 ground", short: "S1L", group: "speed" },
  { key: "0S", name: "Speed 2 ground", short: "S2L", group: "speed" },
  { key: "0T", name: "Speed 3 ground", short: "S3L", group: "speed" },
  { key: "0U", name: "Speed 1 air", short: "S1H", group: "speed" },
  { key: "0V", name: "Speed 2 air", short: "S2H", group: "speed" },
  { key: "0W", name: "Speed 3 air", short: "S3H", group: "speed" },
  { key: "20", name: "P item", short: "P", group: "item", sound: "pitem" },
  { key: "21", name: "Ghost", short: "GH", group: "item", sound: "ghost" },
  { key: "22", name: "Heart", short: "HRT", group: "item", sound: "heart" },
  { key: "23", name: "Blue note", short: "NOTE", group: "item", sound: "bluenote" },
  { key: "10", name: "Music", short: "MUS", group: "fx", sound: "" },
  { key: "1A", name: "Boss entrance", short: "IN", group: "fx" },
  { key: "1B", name: "Boss exit", short: "OUT", group: "fx" },
  { key: "1C", name: "Boss ready 1", short: "R1", group: "fx" },
  { key: "1D", name: "Boss end 1", short: "E1", group: "fx" },
  { key: "1E", name: "Boss ready 2", short: "R2", group: "fx" },
  { key: "1F", name: "Boss end 2", short: "E2", group: "fx" },
  { key: "1G", name: "Swap 1 to 2", short: "1>2", group: "fx" },
  { key: "1H", name: "Swap 2 to 1", short: "2>1", group: "fx" },
  { key: "1J", name: "Hide notes", short: "HIDE", group: "fx" },
  { key: "1K", name: "Unhide notes", short: "SHOW", group: "fx" },
  { key: "1L", name: "Hide boss", short: "HB", group: "fx" },
  { key: "1M", name: "Unhide boss", short: "SB", group: "fx" },
  { key: "1O", name: "Scene: Space Station", short: "SS", group: "fx" },
  { key: "1P", name: "Scene: Retrocity", short: "RET", group: "fx" },
  { key: "1Q", name: "Scene: Castle", short: "CST", group: "fx" },
  { key: "1R", name: "Scene: Rainy Night", short: "RAIN", group: "fx" },
  { key: "1S", name: "Scene: Candyland", short: "CANDY", group: "fx" },
  { key: "1T", name: "Scene: Oriental", short: "ORI", group: "fx" },
  { key: "1U", name: "Scene: Groove Coaster", short: "GC", group: "fx" },
  { key: "1V", name: "Scene: Touhou", short: "TH", group: "fx" },
  { key: "1W", name: "Scene: DJMAX", short: "DJ", group: "fx" },
  { key: "1X", name: "Scene: Miku", short: "MIKU", group: "fx" },
  { key: "30", name: "Medium bullet", short: "MB", group: "fx", sound: "med1" },
  { key: "34", name: "Small bullet", short: "SB", group: "fx", sound: "small" },
  { key: "38", name: "Large bullet", short: "LB", group: "fx", sound: "large1" },
  { key: "25", name: "Hide background", short: "HBG", group: "fx" },
  { key: "26", name: "Show background", short: "SBG", group: "fx" },
  { key: "2Y", name: "Autoplay on", short: "AUTO", group: "fx" },
  { key: "2Z", name: "Autoplay off", short: "PLAY", group: "fx" },
];

export const NOTE_BY_KEY: Record<string, NoteDef> = Object.fromEntries(NOTES.map((n) => [n.key, n]));

export const GROUPS: { id: NoteGroup; label: string }[] = [
  { id: "tap", label: "Taps" },
  { id: "accent", label: "Accents" },
  { id: "hold", label: "Holds" },
  { id: "boss", label: "Boss" },
  { id: "speed", label: "Speed" },
  { id: "item", label: "Items" },
  { id: "fx", label: "FX" },
];

/** Header names written into every chart, same labels as the MDBMSC template. */
export const WAV_HEADER: { key: string; name: string }[] = [
  { key: "01", name: "Small" },
  { key: "02", name: "Small (Up)" },
  { key: "03", name: "Small (Down)" },
  { key: "04", name: "Medium 1" },
  { key: "05", name: "Medium 1 (Up)" },
  { key: "06", name: "Medium 1 (Down)" },
  { key: "07", name: "Medium 2" },
  { key: "08", name: "Medium 2 (Up)" },
  { key: "09", name: "Medium 2 (Down)" },
  { key: "0A", name: "Large 1" },
  { key: "0B", name: "Large 2" },
  { key: "0C", name: "Raider" },
  { key: "0D", name: "Hammer" },
  { key: "0E", name: "Gemini" },
  { key: "0F", name: "Hold" },
  { key: "0G", name: "Masher" },
  { key: "0H", name: "Gear" },
  { key: "0I", name: "Raider (Upside-down)" },
  { key: "0J", name: "Hammer (Upside-down)" },
  { key: "0O", name: "Speed 1 (Both)" },
  { key: "0P", name: "Speed 2 (Both)" },
  { key: "0Q", name: "Speed 3 (Both)" },
  { key: "0R", name: "Speed 1 (Low)" },
  { key: "0S", name: "Speed 2 (Low)" },
  { key: "0T", name: "Speed 3 (Low)" },
  { key: "0U", name: "Speed 1 (High)" },
  { key: "0V", name: "Speed 2 (High)" },
  { key: "0W", name: "Speed 3 (High)" },
  { key: "10", name: "music" },
  { key: "11", name: "Boss Melee 1" },
  { key: "12", name: "Boss Melee 2" },
  { key: "13", name: "Boss Projectile 1" },
  { key: "14", name: "Boss Projectile 2" },
  { key: "15", name: "Boss Projectile 3" },
  { key: "16", name: "Boss Masher 1" },
  { key: "17", name: "Boss Masher 2" },
  { key: "18", name: "Boss Gear" },
  { key: "1A", name: "Boss Entrance" },
  { key: "1B", name: "Boss Exit" },
  { key: "1C", name: "Boss Ready Phase 1" },
  { key: "1D", name: "Boss End Phase 1" },
  { key: "1E", name: "Boss Ready Phase 2" },
  { key: "1F", name: "Boss End Phase 2" },
  { key: "1G", name: "Boss Swap Phase 1-2" },
  { key: "1H", name: "Boss Swap Phase 2-1" },
  { key: "1J", name: "Hide Notes" },
  { key: "1K", name: "Unhide Notes" },
  { key: "1L", name: "Hide Boss" },
  { key: "1M", name: "Unhide boss" },
  { key: "1O", name: "Scene Switch (Space Station)" },
  { key: "1P", name: "Scene Switch (Retrocity)" },
  { key: "1Q", name: "Scene Switch (Castle)" },
  { key: "1R", name: "Scene Switch (Rainy Night)" },
  { key: "1S", name: "Scene Switch (Candyland)" },
  { key: "1T", name: "Scene Switch (Oriental)" },
  { key: "1U", name: "Scene Switch (Groove Coaster)" },
  { key: "1V", name: "Scene Switch (Touhou)" },
  { key: "1W", name: "Scene Switch (DJMAX)" },
  { key: "1X", name: "Scene Switch (Miku)" },
  { key: "20", name: "P Item" },
  { key: "21", name: "Ghost" },
  { key: "22", name: "Heart" },
  { key: "23", name: "Note" },
  { key: "25", name: "Hide Background" },
  { key: "26", name: "Unhide Background" },
  { key: "27", name: "Screen Scroll UP" },
  { key: "28", name: "Screen Scroll DOWN" },
  { key: "29", name: "Screen Scroll OFF" },
  { key: "2A", name: "Scanline Ripples ON" },
  { key: "2B", name: "Scanline Ripples OFF" },
  { key: "2C", name: "Chromatic Aberration ON" },
  { key: "2D", name: "Chromatic Aberration OFF" },
  { key: "2E", name: "Vignette ON" },
  { key: "2F", name: "Vignette OFF" },
  { key: "2G", name: "TV Static ON" },
  { key: "2H", name: "TV Static OFF" },
  { key: "2I", name: "Flashbang START" },
  { key: "2J", name: "Flashbang MID" },
  { key: "2K", name: "Flashbang END" },
  { key: "2N", name: "BG Stop ON" },
  { key: "2O", name: "BG Stop OFF" },
  { key: "2P", name: "Mosaic ON" },
  { key: "2Q", name: "Mosaic OFF" },
  { key: "2R", name: "Sepia ON" },
  { key: "2S", name: "Sepia OFF" },
  { key: "2T", name: "Focus Lines BLACK" },
  { key: "2U", name: "Focus Lines WHITE" },
  { key: "2V", name: "Focus Lines OFF" },
  { key: "2W", name: "Film Grain ON" },
  { key: "2X", name: "Film Grain OFF" },
  { key: "2Y", name: "Autoplay ON" },
  { key: "2Z", name: "Autoplay OFF" },
  { key: "30", name: "Medium Bullet" },
  { key: "31", name: "Medium Bullet (Up)" },
  { key: "32", name: "Medium Bullet (Down)" },
  { key: "33", name: "Medium Bullet (Laneshift)" },
  { key: "34", name: "Small Bullet" },
  { key: "35", name: "Small Bullet (Up)" },
  { key: "36", name: "Small Bullet (Down)" },
  { key: "37", name: "Small Bullet (Laneshift)" },
  { key: "38", name: "Large Bullet" },
  { key: "39", name: "Large Bullet (Up)" },
  { key: "3A", name: "Large Bullet (Down)" },
  { key: "3B", name: "Large Bullet (Laneshift)" },
  { key: "3C", name: "Boss Bullet 1" },
  { key: "3D", name: "Boss Bullet 1 (Laneshift)" },
  { key: "3E", name: "Boss Bullet 2" },
  { key: "3F", name: "Boss Bullet 2 (Laneshift)" },
  { key: "CM", name: "Flashbang Color (White)" },
  { key: "CN", name: "Flashbang Color (Black)" },
  { key: "CO", name: "Flashbang Color (Red)" },
  { key: "CP", name: "Flashbang Color (Green)" },
  { key: "CQ", name: "Flashbang Color (Blue)" },
  { key: "CR", name: "Flashbang Color (Cyan)" },
  { key: "CS", name: "Flashbang Color (Magenta)" },
  { key: "CT", name: "Flashbang Color (Yellow)" },
];

export const SCENES: { id: string; label: string }[] = [
  { id: "scene_01", label: "Space Station" },
  { id: "scene_02", label: "Retrocity" },
  { id: "scene_03", label: "Castle" },
  { id: "scene_04", label: "Rainy Night" },
  { id: "scene_05", label: "Candyland" },
  { id: "scene_06", label: "Oriental" },
  { id: "scene_07", label: "Groove Coaster" },
  { id: "scene_08", label: "Touhou" },
  { id: "scene_09", label: "DJMAX" },
  { id: "scene_10", label: "Miku" },
  { id: "scene_11", label: "Scene 11" },
  { id: "scene_12", label: "Scene 12" },
];

export const HOLD_KEYS = new Set(NOTES.filter((n) => n.hold).map((n) => n.key));

export const WAV_BY_KEY: Record<string, string> = Object.fromEntries(WAV_HEADER.map((item) => [item.key, item.name]));

for (const note of NOTES) {
  if (WAV_BY_KEY[note.key]) note.name = WAV_BY_KEY[note.key];
}

export function noteLabel(key: string): string {
  return NOTE_BY_KEY[key]?.short ?? key;
}

export function noteName(key: string): string {
  return WAV_BY_KEY[key] ?? NOTE_BY_KEY[key]?.name ?? `WAV ${key}`;
}

export function soundFor(key: string): string | undefined {
  const sound = NOTE_BY_KEY[key]?.sound;
  if (!sound) return undefined;
  return `/sfx/${sound}.wav`;
}
