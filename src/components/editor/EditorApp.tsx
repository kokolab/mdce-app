import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chartLabel, readAlbum } from "@/lib/md/album";
import { chartOrigin, currentChartName, setAlbumCharts, setChartOrigin, useAlbumCharts } from "@/lib/md/pack";
import { declaredScene, musicFileName, nextId, rememberInfo, type ChartNote } from "@/lib/md/bms";
import { isGearNote, isPlayNote, normalizeScene, sceneFromNotes } from "@/lib/md/catalog";
import { player } from "@/lib/md/player";
import { clearBrowserLink, desktopApp, linkServerFolder, listLinkedCharts, pickDefaultChart, pickDesktopChart, pickDesktopChartRoot, serverCharts, setSyncedSongName, syncedSongName, writeChartFile } from "@/lib/md/chartFolder";
import { applyLinkedMusic, bootMusic, clearLoadedMusic } from "@/lib/md/musicLink";
import { isChartDirty, persistChart, restoreChart, useChart } from "@/lib/md/store";
import { NotePicker } from "./NotePicker";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar, MobileMenu } from "./MenuBar";
import { Transport } from "./Transport";
import { FolderPicker } from "./FolderPicker";
import { ModeBadge, StatusBar, useEditorMode } from "./EditorChrome";
import { ShortcutsOverlay } from "./ShortcutsOverlay";

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function collectDropped(transfer: DataTransfer | null): Promise<File[]> {
  if (!transfer) return [];
  const entries: FileSystemEntry[] = [];
  for (const item of transfer.items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) return [...transfer.files];
  const files: File[] = [];
  const walk = async (entry: FileSystemEntry) => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      files.push(file);
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      children.push(...batch);
    }
    for (const child of children) await walk(child);
  };
  for (const entry of entries) await walk(entry);
  return files.length ? files : [...transfer.files];
}

function hasMusicMark(notes: ChartNote[]): boolean {
  return notes.some((note) => note.lane === "bgm" || note.key === "10");
}

function warnMusicIfMissing(setOpen: (open: boolean) => void) {
  setOpen(!hasMusicMark(useChart.getState().notes));
}

function placeMusicMarkAtStart() {
  const state = useChart.getState();
  if (hasMusicMark(state.notes)) return;
  const note: ChartNote = { id: nextId(), lane: "bgm", key: "10", tick: 0 };
  useChart.setState((s) => ({
    notes: [...s.notes, note],
    selectedId: note.id,
    selection: [note.id],
    past: [...s.past, { notes: s.notes, sigs: s.sigs, meta: s.meta, measureCount: s.measureCount, extras: s.extras }],
    future: [],
    banner: "Added music mark at the start of the MUSIC row.",
  }));
}

export function EditorApp() {
  const playheadRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bmsInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const notes = useChart((state) => state.notes);
  const songOpen = useChart((state) => state.songOpen);
  const setSongOpen = useChart((state) => state.setSongOpen);
  const songName = useChart((state) => state.songName);
  const banner = useChart((state) => state.banner);
  const album = useAlbumCharts();
  const mode = useEditorMode();
  let playNotes = 0;
  let gearNotes = 0;
  for (const note of notes) {
    if (isPlayNote(note.key)) {
      const isMasher = note.key === "0G" || note.key === "16" || note.key === "17";
      const holdTwo = !isMasher && (note.key === "0F" || note.tapHold);
      playNotes += holdTwo ? 2 : 1;
    } else if (isGearNote(note.key)) gearNotes += 1;
  }
  const [notesOpen, setNotesOpen] = useState(false);
  const [side, setSide] = useState<"panel" | "notes" | null>(() => {
    if (typeof localStorage === "undefined") return "panel";
    const saved = localStorage.getItem("mdce-side");
    if (saved === "notes" || saved === "closed") return saved === "notes" ? "notes" : null;
    return "panel";
  });
  const [saved, setSaved] = useState("Saved");
  const diskStatusRef = useRef<string | null>(null);
  const diskClearRef = useRef(0);
  const [folderPicker, setFolderPicker] = useState<{ folders: string[]; current: string } | null>(null);
  const [folderPick, setFolderPick] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [musicWarnOpen, setMusicWarnOpen] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", localStorage.getItem("stagepen-dark") !== "0");
  }, []);

  useEffect(() => {
    restoreChart();
    void bootMusic();
    let timer = 0;
    const unsub = useChart.subscribe(() => {
      window.clearTimeout(timer);
      if (!diskStatusRef.current) setSaved("Saving");
      timer = window.setTimeout(() => {
        persistChart();
        if (!diskStatusRef.current) setSaved("Saved");
      }, 500);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!isChartDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    if (!musicWarnOpen) return;
    if (hasMusicMark(notes)) setMusicWarnOpen(false);
  }, [notes, musicWarnOpen]);

  function showDiskStatus(text: string, ms = 2500) {
    diskStatusRef.current = text;
    setSaved(text);
    window.clearTimeout(diskClearRef.current);
    diskClearRef.current = window.setTimeout(() => {
      diskStatusRef.current = null;
      setSaved("Saved");
    }, ms);
  }

  async function takeFiles(files: File[]) {
    const state = useChart.getState();
    let loadedChart = false;
    const audio: File[] = [];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (/\.(mdm|md|zip)$/i.test(lower)) {
        const pack = await readAlbum(file);
        if (!pack) {
          state.setBanner("That file is not a chart pack. Use a .mdm (or .md zip) with the chart and music inside.");
          continue;
        }
        await clearLoadedMusic();
        state.loadText(pack.bmsText, pack.bmsName);
        setAlbumCharts(pack.charts, pack.bmsName);
        setChartOrigin("mdm");
        loadedChart = true;
        const fromChart = declaredScene(pack.bmsText) ?? sceneFromNotes(useChart.getState().notes);
        if (pack.infoText) await takeFile(new File([pack.infoText], "info.json", { type: "application/json" }));
        if (fromChart) useChart.getState().patchMeta({ genre: fromChart });
        if (pack.music) audio.push(pack.music);
        continue;
      }
      if (lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml")) {
        await clearLoadedMusic();
        state.loadText(await file.text(), file.name);
        setAlbumCharts([], "");
        setChartOrigin("loose");
        loadedChart = true;
        continue;
      }
      if (lower.endsWith(".json")) {
        await takeFile(file);
        continue;
      }
      if (file.type.startsWith("audio/") || /\.(ogg|mp3|wav|flac|m4a)$/i.test(file.name)) audio.push(file);
    }
    const chart = useChart.getState();
    const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
    const match = wanted ? audio.find((file) => file.name.toLowerCase() === wanted.toLowerCase()) : undefined;
    const song = match ?? (audio.length === 1 ? audio[0] : undefined);
    if (song) {
      await player.ensure();
      await player.loadMusic(song);
      chart.setSongName(song.name);
      chart.setBanner(loadedChart ? `Opened ${chartLabel(currentChartName())}. Song ready: ${song.name}. Press play.` : `Song ready: ${song.name}. Press play.`);
      if (loadedChart) warnMusicIfMissing(setMusicWarnOpen);
      return;
    }
    if (loadedChart) {
      chart.setBanner(wanted ? `Chart loaded. Hits play from built-in sounds. The song is a separate file named ${wanted} — drop it with the chart.` : "Chart loaded. Hits play from built-in sounds. The song is not inside the .bms — drop the audio file with the chart.");
      warnMusicIfMissing(setMusicWarnOpen);
      return;
    }
    if (files.length === 1) await takeFile(files[0]);
  }

  async function takeFile(file: File) {
    const lower = file.name.toLowerCase();
    const state = useChart.getState();
    if (/\.(ogg|mp3|wav|flac|m4a)$/i.test(lower)) {
      await clearLoadedMusic();
      await player.ensure();
      await player.loadMusic(file);
      state.setSongName(file.name);
      state.setBanner(`Song ready: ${file.name}. Press play.`);
      return;
    }
    if (/info\.json$/i.test(lower) || (lower.endsWith(".json") && lower.includes("info"))) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Record<string, unknown>;
        rememberInfo(data);
        const tags = Array.isArray(data.searchTags) ? data.searchTags.map(String).join(", ") : undefined;
        state.patchMeta({
          title: typeof data.name === "string" ? data.name : undefined,
          artist: typeof data.author === "string" ? data.author : undefined,
          genre: typeof data.scene === "string" ? normalizeScene(data.scene) : undefined,
          designer: typeof data.levelDesigner === "string" ? data.levelDesigner : undefined,
          tags,
          difficulty1: data.difficulty1 != null ? String(data.difficulty1) : undefined,
          difficulty2: data.difficulty2 != null ? String(data.difficulty2) : undefined,
          difficulty3: data.difficulty3 != null ? String(data.difficulty3) : undefined,
          difficulty4: data.difficulty4 != null ? String(data.difficulty4) : undefined,
        });
        state.setBanner("Loaded info.json");
      } catch {
        state.setBanner("Could not parse info.json");
      }
      return;
    }
    if (/\.(bms|bme|bml)$/i.test(lower)) {
      await clearLoadedMusic();
      state.loadText(await file.text(), file.name);
      setAlbumCharts([], "");
      setChartOrigin("loose");
      state.setBanner(`Opened ${file.name}`);
      warnMusicIfMissing(setMusicWarnOpen);
      return;
    }
    if (/\.(mdm|md|zip)$/i.test(lower)) await takeFiles([file]);
  }

  async function saveBms() {
    const state = useChart.getState();
    const name = currentChartName() || "chart.bms";
    const content = state.exportBms();
    const origin = chartOrigin();
    const useDisk = origin === "linked" || (origin !== "mdm" && origin !== "loose" && Boolean(syncedSongName()));
    if (useDisk) {
      const wrote = await writeChartFile(name, content);
      if (wrote === "wrote") {
        showDiskStatus("Saved to folder");
        state.setBanner(`Saved ${name}`);
      } else if (wrote === "stale") showDiskStatus("Write stale", 4000);
      else if (wrote === "denied") showDiskStatus("Write denied", 5000);
      else {
        download(name, content, "text/plain");
        state.setBanner(`Downloaded ${name}`);
      }
    } else {
      download(name, content, "text/plain");
      state.setBanner(`Downloaded ${name}`);
    }
    persistChart();
  }

  async function saveInfo() {
    const state = useChart.getState();
    const content = state.exportInfo();
    const origin = chartOrigin();
    const useDisk = origin === "linked" || (origin !== "mdm" && origin !== "loose" && Boolean(syncedSongName()));
    if (useDisk) {
      const wrote = await writeChartFile("info.json", content);
      if (wrote === "wrote") {
        showDiskStatus("Saved info.json");
        state.setBanner("Saved info.json");
      } else {
        download("info.json", content, "application/json");
        state.setBanner("Downloaded info.json");
      }
    } else {
      download("info.json", content, "application/json");
      state.setBanner("Downloaded info.json");
    }
    persistChart();
  }

  async function linkFolder() {
    const state = useChart.getState();
    try {
      let listed = await serverCharts();
      if (desktopApp() && listed.needsPick) {
        listed = await pickDesktopChartRoot();
        if (listed.cancelled) {
          state.setBanner("No chart folder selected.");
          return;
        }
      } else if (!listed.enabled) {
        state.setBanner("Chart folder server is offline.");
        return;
      }
      if (!listed.folders.length) {
        state.setBanner(desktopApp() ? "That folder has no song folders." : "No song folders yet. Extract a .mdm into Custom_Albums first.");
        return;
      }
      const current = syncedSongName() || "";
      const initial = current && listed.folders.includes(current) ? current : listed.folders[0];
      setFolderPick(initial);
      setFolderPicker({ folders: listed.folders, current });
    } catch {
      state.setBanner("Could not list chart folders.");
    }
  }

  async function confirmFolderPick() {
    const pick = folderPick;
    setFolderPicker(null);
    if (!pick) return;
    const state = useChart.getState();
    try {
      await clearLoadedMusic();
      const ok = await linkServerFolder(pick);
      setChartOrigin("linked");
      const charts = await listLinkedCharts();
      const next = pickDefaultChart(charts);
      if (!next) {
        setAlbumCharts([], "");
        state.setBanner(ok ? `Linked ${pick} (no BMS found)` : `Linked ${pick}, but no charts were returned.`);
        return;
      }
      state.loadText(next.text, next.name);
      setAlbumCharts(charts, next.name);
      const head = `Editing ${chartLabel(next.name)}.`;
      state.setBanner(await applyLinkedMusic(head));
      warnMusicIfMissing(setMusicWarnOpen);
    } catch {
      state.setBanner(`Failed to link ${pick}`);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        setShortcutsOpen((s) => !s);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveBms();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openChart() {
    if (!desktopApp()) {
      bmsInput.current?.click();
      return;
    }
    const file = await pickDesktopChart();
    if (file) await takeFiles([file]);
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-chart text-paper"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        void collectDropped(event.dataTransfer).then((files) => takeFiles(files));
      }}
    >
      <MenuBar onOpen={() => void openChart()} onSong={() => audioInput.current?.click()} onLinkFolder={() => void linkFolder()} onSaveBms={() => void saveBms()} onSaveInfo={() => void saveInfo()} onShortcuts={() => setShortcutsOpen(true)} />
      <div className="flex h-12 items-center gap-1.5 border-b border-dock-line bg-menubar px-2 text-dock-ink lg:hidden">
        <MobileMenu onOpen={() => void openChart()} onSong={() => audioInput.current?.click()} onLinkFolder={() => void linkFolder()} onSaveBms={() => void saveBms()} onSaveInfo={() => void saveInfo()} onShortcuts={() => setShortcutsOpen(true)} />
        <Transport compact live={false} playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <button type="button" className="h-10 shrink-0 rounded border border-dock-line bg-field px-3 text-sm" onClick={() => setNotesOpen(true)}>Notes</button>
        <button type="button" className="h-10 shrink-0 rounded border border-dock-line bg-field px-3 text-sm" onClick={() => setSongOpen(!songOpen)}>Panel</button>
      </div>
      <div className="hidden h-11 items-center gap-2 overflow-x-auto border-b border-dock-line bg-menubar px-2 text-dock-ink lg:flex">
        <Transport playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {album.charts.length > 1 ? (
            <label className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-dock-line bg-field px-2 text-sm font-medium">
              <span className="text-mute">Difficulty</span>
              <select className="min-w-24 bg-transparent font-mono" value={album.current} onChange={(event) => {
                const name = event.target.value;
                const chart = album.charts.find((c) => c.name === name);
                if (!chart) return;
                void (async () => {
                  await clearLoadedMusic();
                  useChart.getState().loadText(chart.text, chart.name);
                  setAlbumCharts(album.charts, chart.name);
                  useChart.getState().setBanner(await applyLinkedMusic(`Editing ${chartLabel(chart.name)}.`));
                  warnMusicIfMissing(setMusicWarnOpen);
                })();
              }}>
                {album.charts.map((chart) => (<option key={chart.name} value={chart.name}>{chartLabel(chart.name, useChart.getState().meta)}</option>))}
              </select>
            </label>
          ) : null}
          <ModeBadge mode={mode} />
          <button type="button" className={"h-8 shrink-0 rounded border px-3 text-sm " + (side === "notes" ? "border-pink bg-pink/20 text-dock-ink" : "border-dock-line bg-field text-dock-ink")} onClick={() => { const next = side === "notes" ? null : "notes"; setSide(next); localStorage.setItem("mdce-side", next ?? "closed"); }}>Notes</button>
          <button type="button" className={"h-8 shrink-0 rounded border px-3 text-sm " + (side === "panel" ? "border-pink bg-pink/20 text-dock-ink" : "border-dock-line bg-field text-dock-ink")} onClick={() => { const next = side === "panel" ? null : "panel"; setSide(next); localStorage.setItem("mdce-side", next ?? "closed"); }}>Panel</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="chart-bg flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Roll playheadRef={playheadRef} scrollerRef={scrollerRef} />
          </div>
        </div>
        {side ? (
          <aside className="dock hidden w-80 shrink-0 flex-col overflow-hidden border-l border-dock-line lg:flex">
            {side === "notes" ? <NotePicker onClose={() => { setSide(null); localStorage.setItem("mdce-side", "closed"); }} /> : <Inspector />}
          </aside>
        ) : null}
      </div>
      <StatusBar playNotes={playNotes} gearNotes={gearNotes} mode={mode} songName={songName} banner={banner} saved={saved} />
      {notesOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-paper lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
            <span className="font-semibold">Notes</span>
            <button type="button" className="h-10 rounded border border-white/20 px-3" onClick={() => setNotesOpen(false)}>Close</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto"><NotePicker onClose={() => setNotesOpen(false)} /></div>
        </div>
      ) : null}
      {songOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-paper lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
            <span className="font-semibold">Panel</span>
            <button type="button" className="h-10 rounded border border-white/20 px-3" onClick={() => setSongOpen(false)}>Close</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto"><Inspector /></div>
        </div>
      ) : null}
      {folderPicker ? (
        <FolderPicker
          folders={folderPicker.folders}
          value={folderPick}
          onChange={setFolderPick}
          onLink={() => void confirmFolderPick()}
          onBrowse={desktopApp() ? () => void (async () => {
            const listed = await pickDesktopChartRoot();
            if (listed.cancelled) return;
            if (!listed.folders.length) {
              setFolderPicker(null);
              useChart.getState().setBanner("That folder has no song folders.");
              return;
            }
            const current = syncedSongName() || "";
            const initial = current && listed.folders.includes(current) ? current : listed.folders[0];
            setFolderPick(initial);
            setFolderPicker({ folders: listed.folders, current });
          })() : undefined}
          onClear={() => {
            void clearLoadedMusic();
            void clearBrowserLink();
            setSyncedSongName("");
            setChartOrigin("");
            setFolderPicker(null);
            useChart.getState().setBanner("Unlinked chart folder.");
          }}
          onCancel={() => setFolderPicker(null)}
        />
      ) : null}
      {musicWarnOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={(event) => { if (event.target === event.currentTarget) setMusicWarnOpen(false); }}>
          <div className="w-full max-w-md rounded-xl border border-dock-line bg-dock p-4 text-dock-ink shadow-xl">
            <h2 className="text-base font-semibold text-paper">No music note in chart</h2>
            <p className="mt-2 text-sm text-mute">No MUSIC-row note. Add one at tick 0 so the song can start, or ignore.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="h-10 rounded border border-dock-line px-4 text-sm" onClick={() => setMusicWarnOpen(false)}>Ignore</button>
              <button type="button" className="h-10 rounded bg-paper px-4 text-sm font-semibold text-ink" onClick={() => { placeMusicMarkAtStart(); setMusicWarnOpen(false); }}>Add music note at start</button>
            </div>
          </div>
        </div>
      ) : null}
      {shortcutsOpen ? <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} /> : null}
      <input ref={bmsInput} type="file" accept=".bms,.bme,.bml,.mdm,.md,.zip,application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void takeFiles([file]); }} />
      <input ref={audioInput} type="file" accept="audio/*,.ogg,.mp3,.wav,.flac,.m4a" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void takeFile(file); }} />
    </div>
  );
}
