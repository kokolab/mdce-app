import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chartLabel, readAlbum } from "@/lib/md/album";
import { currentChartName, setAlbumCharts, useAlbumCharts } from "@/lib/md/pack";
import { declaredScene, musicFileName, rememberInfo, type Meta } from "@/lib/md/bms";
import { isGearNote, isPlayNote, normalizeScene, sceneFromNotes } from "@/lib/md/catalog";
import { player } from "@/lib/md/player";
import { linkChartFolder, listLinkedCharts, pickDefaultChart, serverCharts, setSyncedSongName, syncedSongName, writeChartFile } from "@/lib/md/chartFolder";
import { applyLinkedMusic, bootMusic } from "@/lib/md/musicLink";
import { persistChart, restoreChart, useChart } from "@/lib/md/store";
import { NotePicker } from "./NotePicker";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar, MobileMenu } from "./MenuBar";
import { Transport } from "./Transport";
import { FolderPicker } from "./FolderPicker";

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

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function Editor() {
  const playheadRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bmsInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const title = useChart((state) => state.meta.title);
  const notes = useChart((state) => state.notes);
  const songOpen = useChart((state) => state.songOpen);
  const setSongOpen = useChart((state) => state.setSongOpen);
  const selectedId = useChart((state) => state.selectedId);
  const brush = useChart((state) => state.brush);
  const showIcons = useChart((state) => state.showIcons);
  const tool = useChart((state) => state.tool);
  const songName = useChart((state) => state.songName);
  const banner = useChart((state) => state.banner);
  const selected = notes.find((note) => note.id === selectedId);
  const album = useAlbumCharts();
  let playNotes = 0;
  let gearNotes = 0;
  for (const note of notes) {
    if (isPlayNote(note.key)) {
      // Hold / one-tap hold = 2. Mashers (incl. one-tap) always = 1.
      const isMasher = note.key === "0G" || note.key === "16" || note.key === "17";
      const holdTwo = !isMasher && (note.key === "0F" || note.tapHold);
      playNotes += holdTwo ? 2 : 1;
    } else if (isGearNote(note.key)) {
      gearNotes += 1;
    }
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
      unsub();
      window.clearTimeout(timer);
      persistChart();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      const state = useChart.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const step = 0.25;
        state.setBgmSpeed(state.bgmSpeed + (event.key === "ArrowUp" ? step : -step));
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelection();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveBms();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        state.copySelected();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        state.pasteClipboard();
        return;
      }
      if (event.key === "[" || event.key === "]") {
        const steps = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 192];
        const index = steps.indexOf(state.divide);
        const next = event.key === "]" ? Math.min(steps.length - 1, Math.max(0, index) + 1) : Math.max(0, index - 1);
        state.setDivide(steps[next] ?? state.divide);
        return;
      }
      const grid = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      const lane = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!grid && !lane) return;
      event.preventDefault();
      state.nudgeSelection(grid, lane);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDrag = (event: DragEvent) => {
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      void collectDropped(event.dataTransfer).then((files) => takeFiles(files));
    };
    window.addEventListener("dragover", onDrag);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDrag);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

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
        state.loadText(pack.bmsText, pack.bmsName);
        setAlbumCharts(pack.charts, pack.bmsName);
        loadedChart = true;
        const fromChart = declaredScene(pack.bmsText) ?? sceneFromNotes(useChart.getState().notes);
        if (pack.infoText) await takeFile(new File([pack.infoText], "info.json", { type: "application/json" }));
        if (fromChart) useChart.getState().patchMeta({ genre: fromChart });
        if (pack.music) audio.push(pack.music);
        continue;
      }
      if (lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml")) {
        state.loadText(await file.text(), file.name);
        setAlbumCharts([], "");
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
      return;
    }
    if (loadedChart) {
      chart.setBanner(
        wanted
          ? `Chart loaded. Hits play from built-in sounds. The song is a separate file named ${wanted} — drop it with the chart.`
          : "Chart loaded. Hits play from built-in sounds. The song is not inside the .bms — drop the audio file with the chart.",
      );
      return;
    }
    if (files.length === 1) await takeFile(files[0]);
  }

  async function takeFile(file: File) {
    const state = useChart.getState();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml")) {
      state.loadText(await file.text(), file.name);
      return;
    }
    if (lower.endsWith(".json")) {
      try {
        const data = JSON.parse(await file.text()) as Record<string, unknown>;
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
          unlockLevel: data.unlockLevel != null ? String(data.unlockLevel) : undefined,
        });
        state.setBanner("Loaded info.json into the song card.");
      } catch {
        state.setBanner("That JSON was not an info file.");
      }
      return;
    }
    if (file.type.startsWith("audio/") || /\.(ogg|mp3|wav|flac|m4a)$/i.test(file.name)) {
      await player.ensure();
      await player.loadMusic(file);
      state.setSongName(file.name);
      state.setBanner(`Song ready: ${file.name}. Press play.`);
      return;
    }
    state.setBanner("Drop a .bms chart, info.json, or an audio file.");
  }

  function showDiskStatus(message: string, ms = 8000) {
    diskStatusRef.current = message;
    setSaved(message);
    window.clearTimeout(diskClearRef.current);
    diskClearRef.current = window.setTimeout(() => {
      diskStatusRef.current = null;
      setSaved("Saved");
    }, ms);
  }

  async function saveText(name: string, content: string, type: string) {
    setSaved("Writing…");
    diskStatusRef.current = "Writing…";
    const wrote = await writeChartFile(name, content);
    const state = useChart.getState();
    if (wrote === "wrote") {
      const sync = syncedSongName();
      if (sync) {
        showDiskStatus(`On NAS · ${sync}/${name}`, 10000);
      } else {
        showDiskStatus(`Local file · re-enter song`, 8000);
      }
      return;
    }
    if (wrote === "stale") {
      showDiskStatus(`Not on disk — retry ${name}`, 8000);
      state.setBanner("Write did not stick on disk (race or NFS). Try Save again.");
      return;
    }
    if (wrote === "denied") {
      showDiskStatus("Write denied", 5000);
      state.setBanner("Could not write the chart. Link the folder or synced song again.");
      return;
    }
    download(name, content, type);
    showDiskStatus(`Downloaded ${name}`, 5000);
    state.setBanner(
      wrote === "unsupported"
        ? `Downloaded ${name}. Link a chart folder (Chrome) or a synced song folder (Firefox).`
        : `Downloaded ${name}. Link the chart folder or a synced song to overwrite in place.`,
    );
  }

  function saveBms() {
    return saveText(currentChartName(), useChart.getState().exportBms(), "text/plain");
  }

  function saveInfo() {
    return saveText("info.json", useChart.getState().exportInfo(), "application/json");
  }

  async function loadLinkedCharts(bannerPrefix?: string) {
    const state = useChart.getState();
    const charts = await listLinkedCharts();
    if (!charts.length) {
      setAlbumCharts([], "");
      state.setBanner(bannerPrefix ? `${bannerPrefix} No .bms files found in that folder.` : "No .bms files found in the linked folder.");
      return;
    }
    const pick = pickDefaultChart(charts);
    if (!pick) return;
    state.loadText(pick.text, pick.name);
    setAlbumCharts(charts, pick.name);
    const list = charts.map((chart) => chart.name).join(", ");
    const head = bannerPrefix
      ? `${bannerPrefix} Opened ${pick.name}${charts.length > 1 ? ` (${list})` : ""}.`
      : `Opened ${pick.name}${charts.length > 1 ? ` (${list})` : ""}.`;
    state.setBanner(await applyLinkedMusic(head));
  }

  async function linkFolder() {
    const state = useChart.getState();
    try {
      const name = await linkChartFolder();
      if (name) {
        await loadLinkedCharts(`Linked ${name}.`);
        return;
      }
      await linkSyncedSong();
    } catch {
      state.setBanner("Chart folder was not linked.");
    }
  }

  async function linkSyncedSong() {
    const state = useChart.getState();
    const { enabled, folders } = await serverCharts();
    if (!enabled) {
      state.setBanner("Synced chart folder is not mounted on the server. Mount /mnt/Custom_Albums into the container.");
      return;
    }
    if (!folders.length) {
      state.setBanner("No song folders yet. Extract a .mdm into Custom_Albums first.");
      return;
    }
    const current = syncedSongName();
    const initial = current && folders.includes(current) ? current : folders[0];
    setFolderPick(initial);
    setFolderPicker({ folders, current });
  }

  async function confirmFolderPick() {
    const name = folderPick.trim();
    setFolderPicker(null);
    if (!name) {
      setSyncedSongName("");
      setAlbumCharts([], "");
      useChart.getState().setBanner("Cleared the synced song folder.");
      return;
    }
    setSyncedSongName(name);
    await loadLinkedCharts(`Synced song set to ${name}.`);
  }

  async function switchChart(name: string) {
    const state = useChart.getState();
    const next = album.charts.find((chart) => chart.name === name);
    if (!next || next.name === album.current) return;
    await saveBms();
    const charts = album.charts.map((chart) =>
      chart.name === album.current ? { ...chart, text: state.exportBms() } : chart,
    );
    state.loadText(next.text, next.name);
    setAlbumCharts(charts, next.name);
    state.setBanner(`Editing ${chartLabel(next.name)}. Saved previous chart first.`);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-chart text-paper">
      <div className="hidden h-8 items-center gap-4 bg-ink px-3 text-xs text-mute lg:flex">
        <span className="min-w-0 truncate">
          {(title || "untitled") + ".bms"}
          {songName ? ` — ${songName}` : ""} — Muse Dash Chart Editor
        </span>
        {banner ? <span className="ml-auto min-w-0 truncate text-dock-ink">{banner}</span> : null}
      </div>
      <MenuBar
        onOpen={() => bmsInput.current?.click()}
        onSong={() => audioInput.current?.click()}
        onLinkFolder={() => void linkFolder()}
        onSaveBms={() => void saveBms()}
        onSaveInfo={() => void saveInfo()}
      />
      <div className="flex h-12 items-center gap-1.5 border-b border-dock-line bg-menubar px-2 text-dock-ink lg:hidden">
        <MobileMenu
          onOpen={() => bmsInput.current?.click()}
          onSong={() => audioInput.current?.click()}
          onLinkFolder={() => void linkFolder()}
          onSaveBms={() => void saveBms()}
          onSaveInfo={() => void saveInfo()}
        />
        <Transport compact live={false} playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <button type="button" className="h-10 shrink-0 rounded border border-dock-line bg-field px-3 text-sm" onClick={() => setNotesOpen(true)}>
          Notes
        </button>
        <button type="button" className="h-10 shrink-0 rounded border border-dock-line bg-field px-3 text-sm" onClick={() => setSongOpen(!songOpen)}>
          Panel
        </button>
      </div>
      {banner ? <div className="truncate border-b border-dock-line bg-field px-3 py-1 text-xs text-dock-ink lg:hidden">{banner}</div> : null}
      <div className="hidden h-11 items-center gap-2 overflow-x-auto border-b border-dock-line bg-menubar px-2 text-dock-ink lg:flex">
        <Transport playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {album.charts.length > 1 ? (
            <label className="flex h-8 shrink-0 items-center gap-2 rounded border border-dock-line bg-field px-2 text-sm">
              Chart
              <select
                className="bg-transparent"
                value={album.current}
                onChange={(event) => {
                  void switchChart(event.target.value);
                }}
              >
                {album.charts.map((chart) => (
                  <option key={chart.name} value={chart.name}>
                    {chartLabel(chart.name)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className={"h-8 shrink-0 rounded border px-3 text-sm " + (side === "notes" ? "border-pink bg-pink/20 text-dock-ink" : "border-dock-line bg-field text-dock-ink")}
            onClick={() => {
              const next = side === "notes" ? null : "notes";
              setSide(next);
              localStorage.setItem("mdce-side", next ?? "closed");
            }}
          >
            Notes
          </button>
          <button
            type="button"
            className={"h-8 shrink-0 rounded border px-3 text-sm " + (side === "panel" ? "border-pink bg-pink/20 text-dock-ink" : "border-dock-line bg-field text-dock-ink")}
            onClick={() => {
              const next = side === "panel" ? null : "panel";
              setSide(next);
              localStorage.setItem("mdce-side", next ?? "closed");
            }}
          >
            Panel
          </button>
        </div>
      </div>
      {selected?.lane === "bpm" ? (
        <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2 text-sm">
          <label className="flex items-center gap-2 text-mute">
            Tempo
            <input
              type="number"
              min={1}
              max={999}
              value={selected.bpm ?? 120}
              onChange={(event) => useChart.getState().patchSelected({ bpm: Number(event.target.value) || 1 })}
              className="h-9 w-24 rounded border border-white/20 bg-ink px-2 font-mono text-paper"
            />
          </label>
          <button type="button" className="h-9 rounded border border-white/20 px-3" onClick={() => useChart.getState().remove(selected.id)}>
            Delete note
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <div className="chart-bg flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Roll playheadRef={playheadRef} scrollerRef={scrollerRef} />
          </div>
        </div>
        {side ? (
          <aside className="dock hidden w-80 shrink-0 flex-col overflow-hidden border-l border-dock-line lg:flex">
            {side === "notes" ? (
              <NotePicker
                onClose={() => {
                  setSide(null);
                  localStorage.setItem("mdce-side", "closed");
                }}
              />
            ) : (
              <Inspector
                onClose={() => {
                  setSide(null);
                  localStorage.setItem("mdce-side", "closed");
                }}
              />
            )}
          </aside>
        ) : null}
      </div>
      {notesOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-paper lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
            <span className="font-semibold">Notes</span>
            <button type="button" className="h-10 rounded border border-white/20 px-3" onClick={() => setNotesOpen(false)}>
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <NotePicker onClose={() => setNotesOpen(false)} />
          </div>
        </div>
      ) : null}
      {songOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-paper lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
            <span className="font-semibold">Panel</span>
            <button type="button" className="h-10 rounded border border-white/20 px-3" onClick={() => setSongOpen(false)}>
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Inspector onClose={() => setSongOpen(false)} />
          </div>
        </div>
      ) : null}
      {folderPicker ? (
        <FolderPicker
          folders={folderPicker.folders}
          value={folderPick}
          onChange={setFolderPick}
          onLink={() => void confirmFolderPick()}
          onClear={() => {
            setFolderPick("");
            void confirmFolderPick();
          }}
          onCancel={() => setFolderPicker(null)}
        />
      ) : null}
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-dock-line bg-ink px-3 text-xs text-mute">
        <span className="shrink-0 tabular-nums">{saved}</span>
        <span className="ml-auto shrink-0 tabular-nums">
          {playNotes} note{playNotes === 1 ? "" : "s"}
          {" · "}
          {gearNotes} gear{gearNotes === 1 ? "" : "s"}
          {songName ? ` · ${songName}` : ""}
        </span>
      </footer>
      <input
        ref={bmsInput}
        type="file"
        accept=".bms,.bme,.bml,.mdm,.md,.zip,application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void takeFiles([file]);
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*,.ogg,.mp3,.wav,.flac,.m4a"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void takeFile(file);
        }}
      />
    </div>
  );
}
