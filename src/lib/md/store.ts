import { create } from "zustand";
import { DISPLAY_LANES, HOLD_KEYS, flipTravel, normalizeScene, type LaneId } from "./catalog";
import {
  EMPTY_META,
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

function snapshot(state: ChartState): Snapshot {
  return {
    notes: state.notes,
    sigs: state.sigs,
    meta: state.meta,
    measureCount: state.measureCount,
    extras: state.extras,
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
  gotoMeasure: (measure) => {
    const state = get();
    const tick = measureStart(measure, state.sigs);
    set({ focusTick: tick });
  },
  copySelected: () => {
    const state = get();
    if (!state.selection.length) return;
    const notes = state.notes.filter((n) => state.selection.includes(n.id));
    if (!notes.length) return;
    const origin = Math.min(...notes.map((n) => n.tick));
    const clip: ClipNote[] = notes.map((n) => {
      const m = locate(n.tick, state.sigs);
      const end = n.endTick != null ? locate(n.endTick, state.sigs) : null;
      return {
        lane: n.lane,
        key: n.key,
        tapHold: n.tapHold,
        blood: n.blood,
        bpm: n.bpm,
        measureDelta: m.measure - locate(origin, state.sigs).measure,
        local: m.local,
        endMeasureDelta: end ? end.measure - locate(origin, state.sigs).measure : undefined,
        endLocal: end?.local,
      };
    });
    set({ clipboard: { origin, notes: clip }, banner: `Copied ${clip.length} notes.` });
  },
  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard.notes.length) return;
    const focus = state.focusTick ?? 0;
    const base = locate(focus, state.sigs);
    const newNotes: ChartNote[] = state.clipboard.notes.map((c) => {
      const tick = measureStart(base.measure + c.measureDelta, state.sigs) + c.local;
      const endTick =
        c.endMeasureDelta != null && c.endLocal != null
          ? measureStart(base.measure + c.endMeasureDelta, state.sigs) + c.endLocal
          : undefined;
      return {
        id: nextId(),
        lane: c.lane,
        key: c.key,
        tick,
        endTick,
        tapHold: c.tapHold,
        blood: c.blood,
        bpm: c.bpm,
      };
    });
    set((s) => ({
      notes: [...s.notes, ...newNotes],
      selection: newNotes.map((n) => n.id),
      selectedId: newNotes[0]?.id ?? null,
      past: [...s.past, snapshot(s)],
      future: [],
      banner: `Pasted ${newNotes.length} notes.`,
    }));
  },
  cutSelected: () => {
    get().copySelected();
    get().deleteSelection();
  },
  deleteSelection: () => {
    const state = get();
    if (!state.selection.length) return;
    set((s) => ({
      notes: s.notes.filter((n) => !s.selection.includes(n.id)),
      selectedId: null,
      selection: [],
      past: [...s.past, snapshot(s)],
      future: [],
      banner: "Deleted selection.",
    }));
  },
  selectAll: () => {
    const state = get();
    const ids = state.notes.map((n) => n.id);
    set({ selection: ids, selectedId: ids[0] ?? null });
  },
  mirrorLanes: () => {
    const state = get();
    const ids = new Set(state.selection.length ? state.selection : state.notes.map((n) => n.id));
    set((s) => ({
      notes: s.notes.map((n) => (ids.has(n.id) ? { ...n, lane: flipTravel(n.lane) } : n)),
      past: [...s.past, snapshot(s)],
      future: [],
      banner: "Mirrored lanes.",
    }));
  },
  quantizeSelection: () => {
    const state = get();
    if (!state.selection.length) return;
    const snap = state.snap;
    set((s) => ({
      notes: s.notes.map((n) => {
        if (!s.selection.includes(n.id)) return n;
        const tick = snapTick(n.tick, snap, s.sigs, s.measureCount);
        const endTick = n.endTick != null ? snapTick(n.endTick, snap, s.sigs, s.measureCount) : undefined;
        return { ...n, tick, endTick };
      }),
      past: [...s.past, snapshot(s)],
      future: [],
      banner: "Quantized selection.",
    }));
  },
  setSpeed: (key) =>
    set((state) => {
      const level = key === "0O" || key === "1" ? "1" : key === "0P" || key === "2" ? "2" : key === "0Q" || key === "3" ? "3" : "3";
      return { meta: { ...state.meta, noteSpeed: level }, banner: `Default note speed is now ${level}.` };
    }),
  setScene: (scene) => set((state) => ({ meta: { ...state.meta, genre: normalizeScene(scene) }, banner: "Scene updated." })),
  setTool: (tool) => set({ tool }),
  setSongName: (songName) => set({ songName }),
  setShowStage: (showStage) => set({ showStage }),
  findBrush: () => {
    const state = get();
    const note = state.notes.find((n) => n.id === state.selectedId);
    if (note) set({ brush: note.key });
  },
  revealNotes: (ids) => {
    if (!ids.length) return;
    set({ selection: ids, selectedId: ids[0] });
  },
  insertMeasure: (measure) => {
    set((s) => {
      const notes = s.notes.map((n) => {
        if (n.tick >= measureStart(measure, s.sigs)) {
          return { ...n, tick: n.tick + measureTicks(measure, s.sigs) };
        }
        if (n.endTick != null && n.endTick >= measureStart(measure, s.sigs)) {
          return { ...n, endTick: n.endTick + measureTicks(measure, s.sigs) };
        }
        return n;
      });
      return {
        notes,
        measureCount: s.measureCount + 1,
        past: [...s.past, snapshot(s)],
        future: [],
        banner: `Inserted measure ${measure + 1}.`,
      };
    });
  },
  removeMeasure: (measure) => {
    set((s) => {
      const start = measureStart(measure, s.sigs);
      const len = measureTicks(measure, s.sigs);
      const notes = s.notes
        .filter((n) => n.tick < start || n.tick >= start + len)
        .map((n) => {
          if (n.tick >= start + len) return { ...n, tick: n.tick - len };
          if (n.endTick != null && n.endTick >= start + len) return { ...n, endTick: n.endTick - len };
          return n;
        });
      return {
        notes,
        measureCount: Math.max(1, s.measureCount - 1),
        past: [...s.past, snapshot(s)],
        future: [],
        banner: `Removed measure ${measure + 1}.`,
      };
    });
  },
  swapGroundAir: () => {
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.lane === "A") return { ...n, lane: "G" as LaneId };
        if (n.lane === "G") return { ...n, lane: "A" as LaneId };
        return n;
      }),
      past: [...s.past, snapshot(s)],
      future: [],
      banner: "Swapped ground/air.",
    }));
  },
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
  moveGroup: (anchorId, tick, lane) => {
    const state = get();
    const anchor = state.notes.find((n) => n.id === anchorId);
    if (!anchor) return;
    const delta = tick - anchor.tick;
    const ids = new Set(state.selection.includes(anchorId) ? state.selection : [anchorId]);
    set((s) => ({
      notes: s.notes.map((n) => {
        if (!ids.has(n.id)) return n;
        const next: ChartNote = { ...n, tick: n.tick + delta };
        if (n.endTick != null) next.endTick = n.endTick + delta;
        if (lane != null && n.id === anchorId) next.lane = lane;
        return next;
      }),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  nudgeSelection: (gridStep, laneStep) => {
    const state = get();
    if (!state.selection.length) return;
    const step = measureTicks(0, state.sigs) / state.snap;
    set((s) => ({
      notes: s.notes.map((n) => {
        if (!s.selection.includes(n.id)) return n;
        let lane = n.lane;
        if (laneStep) {
          const idx = DISPLAY_LANES.indexOf(n.lane);
          const next = Math.min(DISPLAY_LANES.length - 1, Math.max(0, idx + laneStep));
          lane = DISPLAY_LANES[next];
        }
        const tick = n.tick + gridStep * step;
        const endTick = n.endTick != null ? n.endTick + gridStep * step : undefined;
        return { ...n, lane, tick, endTick };
      }),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  patchMeta: (patch) => set((state) => ({ meta: { ...state.meta, ...patch } })),
  setSig: (measure, ratio) => {
    set((s) => {
      const sigs = s.sigs.filter((g) => g.measure !== measure);
      if (ratio !== 1) sigs.push({ measure, ratio });
      sigs.sort((a, b) => a.measure - b.measure);
      return { sigs, past: [...s.past, snapshot(s)], future: [] };
    });
  },
  place: (lane, tick, endTick, tapHold, blood) => {
    const state = get();
    const key = state.brush;
    const note: ChartNote = {
      id: nextId(),
      lane,
      key,
      tick,
      endTick,
      tapHold,
      blood,
    };
    set((s) => ({
      notes: [...s.notes, note],
      selectedId: note.id,
      selection: [note.id],
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  moveNote: (id, lane, tick) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, lane, tick } : n)),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  resizeNote: (id, endTick) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, endTick } : n)),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  remove: (id) => {
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selection: s.selection.filter((x) => x !== id),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  toggleBlood: () => {
    const state = get();
    if (!state.selectedId) return;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === s.selectedId ? { ...n, blood: !n.blood } : n)),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  patchSelected: (patch) => {
    const state = get();
    if (!state.selectedId) return;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === s.selectedId ? { ...n, ...patch } : n)),
      past: [...s.past, snapshot(s)],
      future: [],
    }));
  },
  undo: () => {
    const state = get();
    if (!state.past.length) return;
    const prev = state.past[state.past.length - 1];
    set({
      ...prev,
      past: state.past.slice(0, -1),
      future: [snapshot(state), ...state.future],
      selectedId: null,
      selection: [],
      banner: "Undid.",
    });
  },
  redo: () => {
    const state = get();
    if (!state.future.length) return;
    const next = state.future[0];
    set({
      ...next,
      past: [...state.past, snapshot(state)],
      future: state.future.slice(1),
      selectedId: null,
      selection: [],
      banner: "Redid.",
    });
  },
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
      past: [],
      future: [],
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
