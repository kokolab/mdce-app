import { create } from "zustand";
import { DISPLAY_LANES, HOLD_KEYS, PARTNER, type LaneId } from "./catalog";
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
  playBpm: number;
  musicOffset: number;
  bgmVolume: number;
  sfxVolume: number;
  focusTick: number | null;
  clipboard: ChartNote[];
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
  moveGroup: (anchorId: string, tick: number, lane?: LaneId) => void;
  patchMeta: (patch: Partial<Meta>) => void;
  setSig: (measure: number, ratio: number) => void;
  place: (lane: LaneId, tick: number, endTick?: number) => void;
  moveNote: (id: string, lane: LaneId, tick: number) => void;
  resizeNote: (id: string, endTick: number) => void;
  remove: (id: string) => void;
  patchSelected: (patch: Partial<ChartNote>) => void;
  undo: () => void;
  redo: () => void;
  loadText: (text: string, name?: string) => void;
  reset: () => void;
  exportBms: () => string;
  exportInfo: () => string;
};

const STORAGE_KEY = "stagepen.v1";

function blank(): Snapshot & { wavExtra: { key: string; name: string }[]; wavNames: Record<string, string>; headerExtras: string[] } {
  return {
    meta: { ...EMPTY_META },
    notes: [],
    sigs: [],
    extras: [],
    wavExtra: [],
    wavNames: {},
    headerExtras: [],
    measureCount: 16,
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
  bgmSpeed: 1,
  playBpm: 120,
  musicOffset: 0,
  bgmVolume: 0.25,
  sfxVolume: 0.25,
  focusTick: null,
  clipboard: [],
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
    const chartBpm = Math.max(1, get().meta.bpm);
    const bgmSpeed = Math.min(4, Math.max(0.25, Math.round(speed * 100) / 100));
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
  gotoMeasure: (measure) =>
    set((state) => ({
      focusTick: measureStart(Math.max(0, Math.floor(measure)), state.sigs),
    })),
  copySelected: () => {
    const state = get();
    const ids = new Set(state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : []);
    const notes = state.notes.filter((note) => ids.has(note.id));
    if (!notes.length) {
      set({ banner: "Select a note before copying." });
      return;
    }
    set({ clipboard: notes.map((note) => ({ ...note })), banner: notes.length === 1 ? "Copied the selected note." : `Copied ${notes.length} notes.` });
  },
  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard.length) {
      set({ banner: "Nothing to paste." });
      return;
    }
    const step = 192 / (state.snapOn ? state.snap : 16);
    const created = state.clipboard.map((clip) => ({
      ...clip,
      id: nextId(),
      tick: clip.tick + step,
      endTick: clip.endTick != null ? clip.endTick + step : undefined,
    }));
    set(
      remember(state, {
        notes: [...state.notes, ...created],
        selectedId: created[0]?.id ?? null,
        selection: created.map((note) => note.id),
        banner: created.length === 1 ? "Pasted the note." : `Pasted ${created.length} notes.`,
      }),
    );
  },
  cutSelected: () => {
    const state = get();
    const ids = new Set(state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : []);
    const notes = state.notes.filter((note) => ids.has(note.id));
    if (!notes.length) {
      set({ banner: "Select a note before cutting." });
      return;
    }
    set({ clipboard: notes.map((note) => ({ ...note })) });
    get().deleteSelection();
  },
  deleteSelection: () =>
    set((state) => {
      const ids = new Set(state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : []);
      if (!ids.size) {
        return { banner: "Select a note before deleting." };
      }
      return remember(state, {
        notes: state.notes.filter((note) => !ids.has(note.id)),
        selectedId: null,
        selection: [],
        banner: ids.size === 1 ? "Deleted the note." : `Deleted ${ids.size} notes.`,
      });
    }),
  selectAll: () =>
    set((state) => {
      const ids = state.notes.map((note) => note.id);
      if (!ids.length) return { banner: "This chart has no notes." };
      return { selectedId: ids[0], selection: ids, banner: `Selected ${ids.length} notes.` };
    }),
  mirrorLanes: () =>
    set((state) => {
      const swap: Partial<Record<LaneId, LaneId>> = { air: "air2", air2: "air", gnd: "gnd2", gnd2: "gnd" };
      const notes = state.notes.map((note) => {
        const lane = swap[note.lane];
        return lane ? { ...note, lane } : note;
      });
      return remember(state, { notes, banner: "Swapped the upper and lower lanes." });
    }),
  quantizeSelection: () =>
    set((state) => {
      const ids = new Set(state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : []);
      if (!ids.size) return { banner: "Select notes before quantizing." };
      const grid = state.snapOn ? state.snap : 192;
      const notes = state.notes.map((note) => {
        if (!ids.has(note.id)) return note;
        const tick = snapTick(note.tick, grid, state.sigs, state.measureCount);
        const length = note.endTick != null ? note.endTick - note.tick : 0;
        return { ...note, tick, endTick: length > 0 ? tick + length : note.endTick };
      });
      return remember(state, { notes, banner: `Snapped ${ids.size} note${ids.size === 1 ? "" : "s"} to the grid.` });
    }),
  setSpeed: (key) =>
    set((state) => {
      const both: Record<string, string> = {
        "0O": "0O",
        "0R": "0O",
        "0U": "0O",
        "0P": "0P",
        "0S": "0P",
        "0V": "0P",
        "0Q": "0Q",
        "0T": "0Q",
        "0W": "0Q",
      };
      const next = both[key] ?? key;
      const existing = state.notes
        .filter((note) => both[note.key])
        .sort((a, b) => a.tick - b.tick)[0];
      const notes = existing
        ? state.notes.map((note) => (note.id === existing.id ? { ...note, key: next } : note))
        : [...state.notes, { id: nextId(), lane: "boss" as const, key: next, tick: 0 }];
      return remember(state, { notes, brush: next, banner: "Note speed written on the first speed note." });
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
  moveGroup: (anchorId, tick, lane) =>
    set((state) => {
      const anchor = state.notes.find((note) => note.id === anchorId);
      if (!anchor) return {};
      const snapped = snapTick(Math.max(0, tick), state.snapOn ? state.snap : 192, state.sigs, state.measureCount);
      const shift = snapped - anchor.tick;
      const from = DISPLAY_LANES.indexOf(anchor.lane);
      const to = lane && !state.lockLane ? DISPLAY_LANES.indexOf(lane) : from;
      const laneShift = to - from;
      if (shift === 0 && laneShift === 0) return {};
      const ids = new Set(state.selection.includes(anchorId) ? state.selection : [anchorId]);
      const notes = state.notes.map((note) => {
        if (!ids.has(note.id)) return note;
        const next = Math.max(0, note.tick + shift);
        const length = note.endTick != null ? note.endTick - note.tick : 0;
        const index = DISPLAY_LANES.indexOf(note.lane) + laneShift;
        const nextLane = DISPLAY_LANES[Math.max(0, Math.min(DISPLAY_LANES.length - 1, index))] ?? note.lane;
        return { ...note, lane: nextLane, tick: next, endTick: length > 0 ? next + length : note.endTick };
      });
      return remember(state, { notes, selectedId: anchorId });
    }),
  patchMeta: (patch) =>
    set((state) => {
      const meta = { ...state.meta };
      (Object.entries(patch) as [keyof Meta, Meta[keyof Meta]][]).forEach(([key, value]) => {
        if (value !== undefined) meta[key] = value as never;
      });
      return { meta, playBpm: patch.bpm != null ? Math.max(1, Math.round(Number(patch.bpm) * state.bgmSpeed)) : state.playBpm };
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
  loadText: (text, name) =>
    set((state) => {
      const parsed = parseBms(text);
      if (!parsed.meta.chartDifficulty) parsed.meta.chartDifficulty = difficultyFromName(name);
      player.setRate(1);
      return remember(state, {
        ...parsed,
        playBpm: Math.max(1, Math.round(parsed.meta.bpm || 120)),
        bgmSpeed: 1,
        selectedId: null,
        selection: [],
        banner: `Opened ${parsed.meta.title || "chart"} · ${parsed.notes.length} notes`,
      });
    }),
  reset: () =>
    set((state) => {
      rememberInfo(null);
      const fresh = blank();
      player.setRate(1);
      return remember(state, { ...fresh, playBpm: 120, bgmSpeed: 1, selectedId: null, selection: [], banner: "New chart.", confirmNew: false });
    }),
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
    wavNames: state.wavNames,
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
    playBpm: state.playBpm,
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
    document.dispatchEvent(new CustomEvent("stagepen-saved"));
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
    if (data.meta.title === "Warm-up" && data.meta.tags === "warmup") return;
    useChart.setState({
      meta: { ...EMPTY_META, ...data.meta },
      notes: data.notes,
      sigs: data.sigs ?? [],
      extras: data.extras ?? [],
      wavExtra: data.wavExtra ?? [],
      wavNames: data.wavNames ?? {},
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
      playBpm: data.playBpm ?? Math.round((data.meta.bpm || 120) * (data.bgmSpeed ?? 1)),
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
    const chartBpm = Math.max(1, data.meta.bpm || 120);
    const playBpm = data.playBpm ?? Math.round(chartBpm * (data.bgmSpeed ?? 1));
    player.setRate(playBpm / chartBpm);
    player.musicOffset = (data.musicOffset ?? 0) / 1000;
  } catch {
    /* ignore broken saves */
  }
}

export function holdBrush(): boolean {
  return HOLD_KEYS.has(useChart.getState().brush);
}
