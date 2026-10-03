import { create } from "zustand";
import { HOLD_KEYS, PARTNER, type LaneId } from "./catalog";
import {
  EMPTY_META,
  chartIssues,
  infoJson,
  nextId,
  parseBms,
  serializeBms,
  type ChartNote,
  type Meta,
  type RawEvent,
} from "./bms";
import { snapTick, measureStart, measureTicks, livePx, pxForWidth, type Sig } from "./timing";
import { player } from "./player";

type Snapshot = {
  notes: ChartNote[];
  sigs: Sig[];
  meta: Meta;
  measureCount: number;
  extras: RawEvent[];
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
  bgmSpeed: number;
  musicOffset: number;
  bgmVolume: number;
  sfxVolume: number;
  focusTick: number | null;
  clipboard: ChartNote | null;
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
  setBgmSpeed: (speed: number) => void;
  setMusicOffset: (ms: number) => void;
  setMix: (bgm: number, sfx: number) => void;
  gotoMeasure: (measure: number) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  setSpeed: (key: string) => void;
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
  moveGroup: (anchorId: string, tick: number) => void;
  patchMeta: (patch: Partial<Meta>) => void;
  setSig: (measure: number, ratio: number) => void;
  place: (lane: LaneId, tick: number, endTick?: number) => void;
  moveNote: (id: string, lane: LaneId, tick: number) => void;
  resizeNote: (id: string, endTick: number) => void;
  remove: (id: string) => void;
  patchSelected: (patch: Partial<ChartNote>) => void;
  undo: () => void;
  redo: () => void;
  loadText: (text: string) => void;
  reset: () => void;
  exportBms: () => string;
  exportInfo: () => string;
};

const STORAGE_KEY = "stagepen.v1";

function at(measure: number, step: number, index: number): number {
  return measure * 192 + Math.round((index / step) * 192);
}

function demoNotes(): ChartNote[] {
  const add = (lane: LaneId, key: string, tick: number, endTick?: number): ChartNote => ({
    id: nextId(),
    lane,
    key,
    tick,
    endTick,
  });
  return [
    add("bgm", "10", 0),
    add("boss", "0P", 0),
    add("gnd", "04", at(0, 4, 0)),
    add("gnd", "04", at(0, 4, 1)),
    add("air", "01", at(0, 8, 3)),
    add("gnd", "04", at(0, 4, 2)),
    add("air", "01", at(0, 8, 7)),
    add("gnd", "0A", at(1, 4, 0)),
    add("air", "0D", at(1, 4, 1)),
    add("gnd", "07", at(1, 4, 2)),
    add("air", "05", at(1, 4, 3)),
    add("gnd", "0F", at(2, 4, 0), at(2, 4, 2)),
    add("air", "02", at(2, 8, 5)),
    add("air", "03", at(2, 8, 7)),
    add("gnd", "0E", at(3, 4, 0)),
    add("air", "0E", at(3, 4, 0)),
    add("gnd", "0C", at(3, 4, 2)),
    add("gnd", "0H", at(3, 4, 3)),
    add("gnd", "04", at(4, 4, 0)),
    add("gnd", "04", at(4, 8, 3)),
    add("air", "07", at(4, 4, 2)),
    add("boss", "13", at(5, 4, 0)),
    add("gnd", "04", at(5, 4, 1)),
    add("air", "04", at(5, 4, 2)),
    add("gnd", "0B", at(5, 4, 3)),
    add("air2", "01", at(6, 4, 0)),
    add("gnd", "0F", at(6, 4, 1), at(6, 4, 3)),
    add("gnd", "22", at(7, 4, 0)),
    add("air", "23", at(7, 4, 2)),
  ];
}

function demo(): Snapshot & { wavExtra: { key: string; name: string }[]; wavNames: Record<string, string>; headerExtras: string[] } {
  return {
    meta: {
      ...EMPTY_META,
      title: "Warm-up",
      artist: "Stagepen",
      designer: "Kokomilk",
      genre: "scene_05",
      bpm: 148,
      difficulty2: "4",
      tags: "warmup",
    },
    notes: demoNotes(),
    sigs: [],
    extras: [],
    wavExtra: [],
    wavNames: {},
    headerExtras: [],
    measureCount: 24,
  };
}

function shot(state: ChartState): Snapshot {
  return {
    notes: state.notes,
    sigs: state.sigs,
    meta: state.meta,
    measureCount: state.measureCount,
    extras: state.extras,
  };
}

function remember(state: ChartState, patch: Partial<ChartState>): Partial<ChartState> {
  return {
    ...patch,
    past: [...state.past, shot(state)].slice(-50),
    future: [],
    confirmNew: false,
  };
}

const seed = demo();

export const useChart = create<ChartState>((set, get) => ({
  ...seed,
  brush: "04",
  showIcons: true,
  snapOn: true,
  lockLane: false,
  followPlay: true,
  followTight: false,
  followAmount: 1,
  bgmSpeed: 1,
  musicOffset: 0,
  bgmVolume: 0.25,
  sfxVolume: 0.25,
  focusTick: null,
  clipboard: null,
  tool: "write",
  songName: "",
  showStage: false,
  snap: 16,
  divide: 16,
  sub: 4,
  xWidth: 4.75,
  xHeight: 2,
  px: pxForWidth(4.75),
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
  setBgmSpeed: (speed) => {
    const bgmSpeed = Math.min(2, Math.max(0.25, Math.round(speed * 100) / 100));
    player.rate = bgmSpeed;
    if (player.playing) player.rearm();
    set({ bgmSpeed });
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
  gotoMeasure: (measure) =>
    set((state) => ({
      focusTick: measureStart(Math.max(0, Math.floor(measure)), state.sigs),
    })),
  copySelected: () => {
    const state = get();
    const note = state.notes.find((item) => item.id === state.selectedId);
    if (!note) return;
    set({ clipboard: { ...note }, banner: "Copied the selected note." });
  },
  pasteClipboard: () => {
    const state = get();
    const clip = state.clipboard;
    if (!clip) return;
    const step = 192 / (state.snapOn ? state.snap : 16);
    const tick = clip.tick + step;
    const length = clip.endTick != null ? clip.endTick - clip.tick : 0;
    set({ brush: clip.lane === "bpm" ? state.brush : clip.key });
    get().place(clip.lane, tick, length > 0 ? tick + length : undefined);
    const created = get().notes.find((note) => note.id === get().selectedId);
    if (created && clip.bpm) get().patchSelected({ bpm: clip.bpm });
  },
  setSpeed: (key) =>
    set((state) => {
      const speeds = new Set(["0O", "0P", "0Q"]);
      const existing = state.notes.find((note) => note.lane === "boss" && note.tick === 0 && speeds.has(note.key));
      const notes = existing
        ? state.notes.map((note) => (note.id === existing.id ? { ...note, key } : note))
        : [...state.notes, { id: nextId(), lane: "boss" as const, key, tick: 0 }];
      return remember(state, { notes, brush: key, banner: "Note speed written on BOSS at the start." });
    }),
  setTool: (tool) => set({ tool }),
  setSongName: (songName) => set({ songName }),
  setShowStage: (showStage) => set({ showStage }),
  findBrush: () => {
    const state = get();
    const hits = state.notes.filter((note) => note.key === state.brush).sort((a, b) => a.tick - b.tick);
    if (!hits.length) {
      set({ banner: "No notes use the current brush." });
      return;
    }
    const current = hits.find((note) => note.id === state.selectedId);
    const start = current ? current.tick : -1;
    const next = hits.find((note) => note.tick > start) ?? hits[0];
    set({ selectedId: next.id, focusTick: next.tick, banner: "Found the next matching note." });
  },
  revealNotes: (ids) => {
    const state = get();
    if (!ids.length) return;
    const index = ids.indexOf(state.selectedId ?? "");
    const id = ids[(index + 1) % ids.length] ?? ids[0];
    const note = state.notes.find((item) => item.id === id);
    set({ selectedId: id, selection: ids, focusTick: note?.tick ?? 0 });
  },
  insertMeasure: (measure) =>
    set((state) => {
      const at = Math.max(0, Math.floor(measure));
      const start = measureStart(at, state.sigs);
      const len = measureTicks(at, state.sigs);
      const notes = state.notes.map((note) =>
        note.tick >= start
          ? { ...note, tick: note.tick + len, endTick: note.endTick != null ? note.endTick + len : undefined }
          : note,
      );
      const sigs = state.sigs.map((sig) => (sig.measure >= at ? { ...sig, measure: sig.measure + 1 } : sig));
      return remember(state, { notes, sigs, measureCount: state.measureCount + 1, banner: `Inserted a measure at ${at}.` });
    }),
  removeMeasure: (measure) =>
    set((state) => {
      const at = Math.max(0, Math.floor(measure));
      if (state.measureCount <= 1) return {};
      const start = measureStart(at, state.sigs);
      const len = measureTicks(at, state.sigs);
      const end = start + len;
      const notes = state.notes
        .filter((note) => note.tick < start || note.tick >= end)
        .map((note) =>
          note.tick >= end
            ? { ...note, tick: note.tick - len, endTick: note.endTick != null ? note.endTick - len : undefined }
            : note,
        );
      const sigs = state.sigs
        .filter((sig) => sig.measure !== at)
        .map((sig) => (sig.measure > at ? { ...sig, measure: sig.measure - 1 } : sig));
      return remember(state, {
        notes,
        sigs,
        measureCount: state.measureCount - 1,
        selectedId: null,
        selection: [],
        banner: `Removed measure ${at}.`,
      });
    }),
  swapGroundAir: () =>
    set((state) => {
      const swap: Partial<Record<LaneId, LaneId>> = { air: "gnd", gnd: "air", air2: "gnd2", gnd2: "air2" };
      const notes = state.notes.map((note) => {
        const lane = swap[note.lane];
        return lane ? { ...note, lane } : note;
      });
      return remember(state, { notes, banner: "Swapped air and ground." });
    }),
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
    const xWidth = Math.min(16, Math.max(0.5, Math.round(width * 100) / 100));
    const px = pxForWidth(xWidth);
    livePx.current = px;
    set({ xWidth, px });
  },
  setXHeight: (height) => set({ xHeight: Math.min(8, Math.max(0.5, Math.round(height * 100) / 100)) }),
  setPx: (px) => {
    const next = Math.min(pxForWidth(16), Math.max(pxForWidth(0.5), Math.round(px)));
    livePx.current = next;
    set({ px: next, xWidth: Math.round((next / 192) * 100) / 100 });
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
  moveGroup: (anchorId, tick) =>
    set((state) => {
      const anchor = state.notes.find((note) => note.id === anchorId);
      if (!anchor) return {};
      const snapped = snapTick(Math.max(0, tick), state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const shift = snapped - anchor.tick;
      if (shift === 0) return {};
      const ids = new Set(state.selection.includes(anchorId) ? state.selection : [anchorId]);
      const notes = state.notes.map((note) => {
        if (!ids.has(note.id)) return note;
        const next = Math.max(0, note.tick + shift);
        const length = note.endTick != null ? note.endTick - note.tick : 0;
        return { ...note, tick: next, endTick: length > 0 ? next + length : note.endTick };
      });
      return remember(state, { notes, selectedId: anchorId });
    }),
  patchMeta: (patch) =>
    set((state) => {
      const meta = { ...state.meta };
      (Object.entries(patch) as [keyof Meta, Meta[keyof Meta]][]).forEach(([key, value]) => {
        if (value !== undefined) meta[key] = value as never;
      });
      return { meta };
    }),
  setSig: (measure, ratio) =>
    set((state) => {
      const sigs = state.sigs.filter((sig) => sig.measure !== measure);
      if (Math.abs(ratio - 1) > 0.0001) sigs.push({ measure, ratio });
      sigs.sort((a, b) => a.measure - b.measure);
      return remember(state, { sigs });
    }),
  place: (lane, tick, endTick) =>
    set((state) => {
      const key = state.brush;
      const snapped = snapTick(tick, state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const end = endTick == null ? undefined : snapTick(endTick, state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const notes = state.notes.filter((note) => !(note.lane === lane && Math.abs(note.tick - snapped) <= 1));
      const created: ChartNote = {
        id: nextId(),
        lane,
        key: lane === "bpm" ? "BPM" : key,
        tick: snapped,
        bpm: lane === "bpm" ? state.meta.bpm : undefined,
        endTick: end != null && end > snapped ? end : undefined,
      };
      notes.push(created);
      if (key === "0E" && lane !== "bpm") {
        const partner = PARTNER[lane];
        if (partner && !notes.some((note) => note.lane === partner && Math.abs(note.tick - snapped) <= 1)) {
          notes.push({ id: nextId(), lane: partner, key: "0E", tick: snapped });
        }
      }
      const spot = Math.floor(snapped / 192) + 8;
      return remember(state, {
        notes,
        selectedId: created.id,
        selection: [created.id],
        measureCount: Math.max(state.measureCount, spot),
      });
    }),
  moveNote: (id, lane, tick) =>
    set((state) => {
      const snapped = snapTick(tick, state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const notes = state.notes.map((note) => {
        if (note.id !== id) return note;
        const length = note.endTick != null ? note.endTick - note.tick : 0;
        const nextLane = state.lockLane ? note.lane : lane;
        return { ...note, lane: nextLane, tick: snapped, endTick: length > 0 ? snapped + length : note.endTick };
      });
      return remember(state, { notes, selectedId: id });
    }),
  resizeNote: (id, endTick) =>
    set((state) => {
      const end = snapTick(endTick, state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const notes = state.notes.map((note) => {
        if (note.id !== id) return note;
        if (end <= note.tick) return { ...note, endTick: undefined };
        return { ...note, endTick: end };
      });
      return remember(state, { notes });
    }),
  remove: (id) =>
    set((state) =>
      remember(state, {
        notes: state.notes.filter((note) => note.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
        selection: state.selection.filter((item) => item !== id),
      }),
    ),
  patchSelected: (patch) =>
    set((state) => {
      if (!state.selectedId) return {};
      const notes = state.notes.map((note) => (note.id === state.selectedId ? { ...note, ...patch, id: note.id } : note));
      return remember(state, { notes });
    }),
  undo: () =>
    set((state) => {
      const prev = state.past[state.past.length - 1];
      if (!prev) return {};
      return { ...prev, past: state.past.slice(0, -1), future: [...state.future, shot(state)], selectedId: null, selection: [] };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[state.future.length - 1];
      if (!next) return {};
      return { ...next, future: state.future.slice(0, -1), past: [...state.past, shot(state)], selectedId: null, selection: [] };
    }),
  loadText: (text) =>
    set((state) => {
      const parsed = parseBms(text);
      return remember(state, {
        ...parsed,
        selectedId: null,
        selection: [],
        banner: `Opened ${parsed.meta.title || "chart"} · ${parsed.notes.length} notes`,
      });
    }),
  reset: () =>
    set((state) => {
      const fresh = demo();
      return remember(state, { ...fresh, selectedId: null, selection: [], banner: "Fresh warm-up chart.", confirmNew: false });
    }),
  exportBms: () => {
    const state = get();
    return serializeBms(state);
  },
  exportInfo: () => infoJson(get().meta),
}));

export function selectedNote(): ChartNote | undefined {
  const { notes, selectedId } = useChart.getState();
  return notes.find((note) => note.id === selectedId);
}

export function issuesNow(): string[] {
  const state = useChart.getState();
  return chartIssues(state.notes, state.sigs).map((issue) => issue.text);
}

export function persistChart() {
  const state = useChart.getState();
  const payload = {
    meta: state.meta,
    notes: state.notes,
    sigs: state.sigs,
    extras: state.extras,
    wavExtra: state.wavExtra,
    headerExtras: state.headerExtras,
    measureCount: state.measureCount,
    brush: state.brush,
    showIcons: state.showIcons,
    snapOn: state.snapOn,
    lockLane: state.lockLane,
    followPlay: state.followPlay,
    followTight: state.followTight,
    followAmount: state.followAmount,
    bgmSpeed: state.bgmSpeed,
    musicOffset: state.musicOffset,
    bgmVolume: state.bgmVolume,
    sfxVolume: state.sfxVolume,
    snap: state.snap,
    divide: state.divide,
    sub: state.sub,
    xWidth: state.xWidth,
    xHeight: state.xHeight,
    px: state.px,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function restoreChart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<ChartState>;
    if (!data.notes || !data.meta) return;
    useChart.setState({
      meta: { ...EMPTY_META, ...data.meta },
      notes: data.notes,
      sigs: data.sigs ?? [],
      extras: data.extras ?? [],
      wavExtra: data.wavExtra ?? [],
      headerExtras: data.headerExtras ?? [],
      measureCount: data.measureCount ?? 24,
      brush: data.brush ?? "04",
      showIcons: data.showIcons ?? true,
      snapOn: data.snapOn ?? true,
      lockLane: data.lockLane ?? false,
      followPlay: data.followPlay ?? true,
      followTight: data.followTight ?? false,
      followAmount: data.followAmount ?? 1,
      bgmSpeed: data.bgmSpeed ?? 1,
      musicOffset: data.musicOffset ?? 0,
      bgmVolume: data.bgmVolume == null || data.bgmVolume === 0.85 ? 0.25 : data.bgmVolume,
      sfxVolume: data.sfxVolume == null || data.sfxVolume === 0.8 ? 0.25 : data.sfxVolume,
      divide: data.divide ?? 16,
      sub: data.sub ?? 4,
      snap: data.divide ?? 16,
      xWidth: data.xWidth ?? 4.75,
      xHeight: data.xHeight ?? 2,
      px: pxForWidth(data.xWidth ?? 4.75),
      past: [],
      future: [],
      banner: "Restored your last chart on this computer.",
    });
    livePx.current = pxForWidth(data.xWidth ?? 4.75);
    player.setMix(data.bgmVolume == null || data.bgmVolume === 0.85 ? 0.25 : data.bgmVolume, data.sfxVolume == null || data.sfxVolume === 0.8 ? 0.25 : data.sfxVolume);
    player.rate = data.bgmSpeed ?? 1;
    player.musicOffset = (data.musicOffset ?? 0) / 1000;
  } catch {
    /* ignore broken saves */
  }
}

export function holdBrush(): boolean {
  return HOLD_KEYS.has(useChart.getState().brush);
}
