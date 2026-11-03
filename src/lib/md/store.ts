import { create } from "zustand";
import { DISPLAY_LANES, HOLD_KEYS, PARTNER, flipTravel, normalizeScene, type LaneId } from "./catalog";
import {
  EMPTY_META,
  chartIssues,
  difficultyFromName,
  infoJson,
  nextId,
  parseBms,
  rememberInfo,
  serializeBms,
  type ChartNote,
  type Meta,
  type RawEvent,
} from "./bms";
import { snapTick, measureStart, measureTicks, locate, livePx, pxForWidth, type Sig } from "./timing";
import { player } from "./player";

// TEMPORARY RECOVERY STUB - full restore in progress
const STORAGE_KEY = "stagepen.v1";
const PREFS_KEY = "stagepen.prefs.v1";

type Snapshot = {
  notes: ChartNote[];
  sigs: Sig[];
  meta: Meta;
  measureCount: number;
  extras: RawEvent[];
};

type ClipNote = {
  lane: LaneId;
  key: string;
  tapHold?: boolean;
  blood?: boolean;
  bpm?: number;
  measureDelta: number;
  local: number;
  endMeasureDelta?: number;
  endLocal?: number;
};

type ChartState = {
  meta: Meta;
  notes: ChartNote[];
  sigs: Sig[];
  extras: RawEvent[];
  wavExtra: { key: string; name: string }[];
  wavNames: Record<string, string>;
  headerExtras: string[];
  measureCount: number;
  brush: string;
  snap: number;
  divide: number;
  sub: number;
  xWidth: number;
  xHeight: number;
  px: number;
  showIcons: boolean;
  snapOn: boolean;
  lockLane: boolean;
  followPlay: boolean;
  followTight: boolean;
  followAmount: number;
  zoomSensitivity: number;
  bgmSpeed: number;
  playBpm: number;
  musicOffset: number;
  bgmVolume: number;
  sfxVolume: number;
  focusTick: number | null;
  clipboard: { origin: number; notes: ClipNote[] };
  tool: "write" | "select";
  songName: string;
  showStage: boolean;
  selectedId: string | null;
  selection: string[];
  banner: string;
  songOpen: boolean;
  confirmNew: boolean;
  past: Snapshot[];
  future: Snapshot[];
  setBanner: (banner: string) => void;
  setSongOpen: (open: boolean) => void;
  setBrush: (key: string) => void;
  setShowIcons: (show: boolean) => void;
  setSnapOn: (on: boolean) => void;
  setLockLane: (on: boolean) => void;
  setFollowPlay: (on: boolean) => void;
  setFollowTight: (on: boolean) => void;
  setFollowAmount: (amount: number) => void;
  setZoomSensitivity: (amount: number) => void;
  setBgmSpeed: (speed: number) => void;
  setPlayBpm: (bpm: number) => void;
  setMusicOffset: (ms: number) => void;
  setMix: (bgm: number, sfx: number) => void;
  gotoMeasure: (measure: number) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  cutSelected: () => void;
  deleteSelection: () => void;
  selectAll: () => void;
  mirrorLanes: () => void;
  quantizeSelection: () => void;
  setSpeed: (key: string) => void;
  setScene: (scene: string) => void;
  setTool: (tool: "write" | "select") => void;
  setSongName: (name: string) => void;
  setShowStage: (show: boolean) => void;
  findBrush: () => void;
  revealNotes: (ids: string[]) => void;
  insertMeasure: (measure: number) => void;
  removeMeasure: (measure: number) => void;
  swapGroundAir: () => void;
  setSnap: (snap: number) => void;
  setDivide: (divide: number) => void;
  setSub: (sub: number) => void;
  setXWidth: (width: number) => void;
  setXHeight: (height: number) => void;
  setPx: (px: number) => void;
  select: (id: string | null, extend?: boolean) => void;
  selectIds: (ids: string[]) => void;
  moveGroup: (anchorId: string, tick: number, lane?: LaneId) => void;
  nudgeSelection: (gridStep: number, laneStep: number) => void;
  patchMeta: (patch: Partial<Meta>) => void;
  setSig: (measure: number, ratio: number) => void;
  place: (lane: LaneId, tick: number, endTick?: number, tapHold?: boolean, blood?: boolean) => void;
  moveNote: (id: string, lane: LaneId, tick: number) => void;
  resizeNote: (id: string, endTick: number) => void;
  remove: (id: string) => void;
  toggleBlood: () => void;
  patchSelected: (patch: Partial<ChartNote>) => void;
  undo: () => void;
  redo: () => void;
  loadText: (text: string, name?: string) => void;
  reset: () => void;
  exportBms: () => string;
  exportInfo: () => string;
};

function blank() {
  return {
    meta: { ...EMPTY_META },
    notes: [] as ChartNote[],
    sigs: [] as Sig[],
    extras: [] as RawEvent[],
    wavExtra: [] as { key: string; name: string }[],
    wavNames: {} as Record<string, string>,
    headerExtras: [] as string[],
    measureCount: 16,
  };
}

const seed = blank();

export const useChart = create<ChartState>((set, get) => ({
  ...seed,
  brush: "04",
  showIcons: true,
  snapOn: true,
  lockLane: false,
  followPlay: true,
  followTight: false,
  followAmount: 1,
  zoomSensitivity: 0.25,
  bgmSpeed: 1,
  playBpm: 120,
  musicOffset: 0,
  bgmVolume: 0.25,
  sfxVolume: 0.25,
  focusTick: null,
  clipboard: { origin: 0, notes: [] },
  tool: "write",
  songName: "",
  showStage: false,
  snap: 16,
  divide: 16,
  sub: 4,
  xWidth: 4.8,
  xHeight: 2,
  px: pxForWidth(4.8),
  selectedId: null,
  selection: [],
  banner: "Left-click places. Drag a hold. Right-click erases.",
  songOpen: false,
  confirmNew: false,
  past: [],
  future: [],
  setBanner: (banner) => set({ banner }),
  setSongOpen: (songOpen) => set({ songOpen }),
  setBrush: (brush) => set({ brush, confirmNew: false }),
  setShowIcons: (showIcons) => set({ showIcons }),
  setSnapOn: (snapOn) => set({ snapOn }),
  setLockLane: (lockLane) => set({ lockLane }),
  setFollowPlay: (followPlay) => set({ followPlay }),
  setFollowTight: (followTight) => set({ followTight }),
  setFollowAmount: (followAmount) => set({ followAmount: Math.min(1, Math.max(0, followAmount)) }),
  setZoomSensitivity: (amount) => set({ zoomSensitivity: Math.min(1, Math.max(0.05, Math.round(amount * 20) / 20)) }),
  setBgmSpeed: (speed) => {
    const chartBpm = Math.max(1, get().meta.bpm);
    const bgmSpeed = Math.min(2, Math.max(0.25, Math.round(speed * 100) / 100));
    player.setRate(bgmSpeed);
    set({ bgmSpeed: player.rate, playBpm: Math.round(chartBpm * player.rate) });
  },
  setPlayBpm: (bpm) => {
    const chartBpm = Math.max(1, get().meta.bpm);
    const playBpm = Math.min(999, Math.max(1, Math.round(bpm)));
    player.setRate(playBpm / chartBpm);
    set({ playBpm: Math.round(chartBpm * player.rate), bgmSpeed: Math.round(player.rate * 100) / 100 });
  },
  setMusicOffset: (ms) => {
    const musicOffset = Math.min(5000, Math.max(-5000, Math.round(ms)));
    player.musicOffset = musicOffset / 1000;
    if (player.playing) player.rearm();
    set({ musicOffset });
  },
  setMix: (bgmVolume, sfxVolume) => {
    player.setMix(bgmVolume, sfxVolume);
    set({ bgmVolume, sfxVolume });
  },
  gotoMeasure: () => {},
  copySelected: () => {},
  pasteClipboard: () => {},
  cutSelected: () => {},
  deleteSelection: () => {},
  selectAll: () => {},
  mirrorLanes: () => {},
  quantizeSelection: () => {},
  setSpeed: (key) =>
    set((state) => {
      const level = key === "0O" || key === "1" ? "1" : key === "0P" || key === "2" ? "2" : key === "0Q" || key === "3" ? "3" : "";
      return { meta: { ...state.meta, noteSpeed: level }, banner: level ? `Default note speed is now ${level}.` : "Default note speed cleared." };
    }),
  setScene: (scene) => set((state) => ({ meta: { ...state.meta, genre: normalizeScene(scene) }, banner: "Scene updated." })),
  setTool: (tool) => set({ tool }),
  setSongName: (songName) => set({ songName }),
  setShowStage: (showStage) => set({ showStage }),
  findBrush: () => {},
  revealNotes: () => {},
  insertMeasure: () => {},
  removeMeasure: () => {},
  swapGroundAir: () => {},
  setSnap: (snap) => {
    const divide = Math.min(192, Math.max(1, Math.round(snap)));
    set({ divide, snap: divide });
  },
  setDivide: (divide) => {
    const next = Math.min(192, Math.max(1, Math.round(divide)));
    set({ divide: next, snap: next });
  },
  setSub: (sub) => set({ sub: Math.min(192, Math.max(1, Math.round(sub))) }),
  setXWidth: (width) => {
    const xWidth = Math.min(16, Math.max(0.5, Math.round(width * 10) / 10));
    const px = pxForWidth(xWidth);
    livePx.current = px;
    set({ xWidth, px });
  },
  setXHeight: (height) => set({ xHeight: Math.min(8, Math.max(0.5, Math.round(height * 100) / 100)) }),
  setPx: (px) => {
    const xWidth = Math.min(16, Math.max(0.5, Math.round((px / 192) * 10) / 10));
    const next = pxForWidth(xWidth);
    livePx.current = next;
    set({ px: next, xWidth });
  },
  select: (selectedId, extend = false) =>
    set((state) => {
      if (!selectedId) return { selectedId: null, selection: [] };
      if (!extend) return { selectedId, selection: [selectedId] };
      const selection = state.selection.includes(selectedId)
        ? state.selection.filter((id) => id !== selectedId)
        : [...state.selection, selectedId];
      return { selectedId, selection: selection.length ? selection : [selectedId] };
    }),
  selectIds: (ids) =>
    set((state) => {
      const selectedId = state.selectedId && ids.includes(state.selectedId) ? state.selectedId : (ids[0] ?? null);
      return { selectedId, selection: ids };
    }),
  moveGroup: () => {},
  nudgeSelection: () => {},
  patchMeta: (patch) => set((state) => ({ meta: { ...state.meta, ...patch } })),
  setSig: () => {},
  place: () => {},
  moveNote: () => {},
  resizeNote: () => {},
  remove: () => {},
  toggleBlood: () => {},
  patchSelected: () => {},
  undo: () => {},
  redo: () => {},
  loadText: (text, name) => {
    const parsed = parseBms(text);
    if (!parsed.meta.chartDifficulty) parsed.meta.chartDifficulty = difficultyFromName(name);
    player.setRate(1);
    set({
      ...parsed,
      playBpm: Math.max(1, Math.round(parsed.meta.bpm || 120)),
      bgmSpeed: 1,
      selectedId: null,
      selection: [],
      banner: `Opened ${parsed.meta.title || "chart"} · ${parsed.notes.length} notes`,
    });
  },
  reset: () => {
    rememberInfo(null);
    const fresh = blank();
    player.setRate(1);
    set({ ...fresh, playBpm: 120, bgmSpeed: 1, selectedId: null, selection: [], banner: "New chart.", confirmNew: false, past: [], future: [] });
  },
  exportBms: () => {
    const state = get();
    const wavNames = { ...state.wavNames };
    if (state.songName) wavNames["10"] = state.songName;
    return serializeBms({ ...state, wavNames });
  },
  exportInfo: () => infoJson(get().meta),
}));

export function selectedNote(): ChartNote | undefined {
  const { notes, selectedId } = useChart.getState();
  return notes.find((n) => n.id === selectedId);
}

export function persistChart() {
  const state = useChart.getState();
  const prefs = {
    brush: state.brush,
    showIcons: state.showIcons,
    snapOn: state.snapOn,
    lockLane: state.lockLane,
    followPlay: state.followPlay,
    followTight: state.followTight,
    followAmount: state.followAmount,
    zoomSensitivity: state.zoomSensitivity,
    bgmVolume: state.bgmVolume,
    sfxVolume: state.sfxVolume,
    divide: state.divide,
    sub: state.sub,
    xWidth: state.xWidth,
    xHeight: state.xHeight,
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    localStorage.removeItem(STORAGE_KEY);
    document.dispatchEvent(new CustomEvent("stagepen-saved"));
  } catch {
    /* quota */
  }
}

export function restoreChart() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<ChartState>;
    const patch: Partial<ChartState> = {};
    if (typeof data.brush === "string") patch.brush = data.brush;
    if (typeof data.showIcons === "boolean") patch.showIcons = data.showIcons;
    if (typeof data.snapOn === "boolean") patch.snapOn = data.snapOn;
    if (typeof data.lockLane === "boolean") patch.lockLane = data.lockLane;
    if (typeof data.followPlay === "boolean") patch.followPlay = data.followPlay;
    if (typeof data.followTight === "boolean") patch.followTight = data.followTight;
    if (typeof data.followAmount === "number") patch.followAmount = data.followAmount;
    if (typeof data.zoomSensitivity === "number") patch.zoomSensitivity = data.zoomSensitivity;
    if (typeof data.bgmVolume === "number") patch.bgmVolume = data.bgmVolume;
    if (typeof data.sfxVolume === "number") patch.sfxVolume = data.sfxVolume;
    if (typeof data.divide === "number") {
      patch.divide = data.divide;
      patch.snap = data.divide;
    }
    if (typeof data.sub === "number") patch.sub = data.sub;
    if (typeof data.xWidth === "number") {
      const xWidth = Math.round(data.xWidth * 10) / 10;
      patch.xWidth = xWidth;
      patch.px = pxForWidth(xWidth);
      livePx.current = patch.px;
    }
    if (typeof data.xHeight === "number") patch.xHeight = data.xHeight;
    if (Object.keys(patch).length) useChart.setState(patch);
    if (typeof data.bgmVolume === "number" || typeof data.sfxVolume === "number") {
      const s = useChart.getState();
      player.setMix(s.bgmVolume, s.sfxVolume);
    }
  } catch {
    /* ignore */
  }
}

export function isChartDirty(): boolean {
  const state = useChart.getState();
  if (state.notes.length > 0) return true;
  if (state.sigs.length > 0 || state.extras.length > 0) return true;
  if (state.measureCount !== 16) return true;
  if (state.past.length > 0) return true;
  const m = state.meta;
  if (m.title || m.artist || m.designer || m.tags) return true;
  if (m.difficulty1 || m.difficulty2 || m.difficulty3 || m.difficulty4) return true;
  if (m.noteSpeed && m.noteSpeed !== "3") return true;
  if (state.songName) return true;
  return false;
}

export function holdBrush(): boolean {
  return HOLD_KEYS.has(useChart.getState().brush);
}
