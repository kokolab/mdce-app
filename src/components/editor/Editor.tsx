import { useEffect, useLayoutEffect, useRef } from "react";
import { DISPLAY_LANES } from "@/lib/md/catalog";
import { readAlbum } from "@/lib/md/album";
import { musicFileName, type Meta } from "@/lib/md/bms";
import { player } from "@/lib/md/player";
import { persistChart, restoreChart, useChart } from "@/lib/md/store";
import { Palette } from "./Palette";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar } from "./MenuBar";
import { Stage } from "./Stage";
import { Transport } from "./Transport";

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
  const showStage = useChart((state) => state.showStage);
  const songName = useChart((state) => state.songName);
  const selected = notes.find((note) => note.id === selectedId);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", localStorage.getItem("stagepen-dark") !== "0");
  }, []);

  useEffect(() => {
    restoreChart();
    let timer = 0;
    const unsub = useChart.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => persistChart(), 500);
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
      if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedId) {
          event.preventDefault();
          state.remove(state.selectedId);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
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
      const note = state.notes.find((item) => item.id === state.selectedId);
      if (!note) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = 192 / state.snap;
        state.moveGroup(note.id, note.tick + (event.key === "ArrowRight" ? step : -step));
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        if (state.lockLane) return;
        const index = DISPLAY_LANES.findIndex((lane) => lane === note.lane);
        const next = DISPLAY_LANES[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) state.moveNote(note.id, next, note.tick);
      }
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
        state.loadText(pack.bmsText);
        loadedChart = true;
        if (pack.infoText) await takeFile(new File([pack.infoText], "info.json", { type: "application/json" }));
        if (pack.music) audio.push(pack.music);
        continue;
      }
      if (lower.endsWith(".bms") || lower.endsWith(".bme") || lower.endsWith(".bml")) {
        state.loadText(await file.text());
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
      chart.setBanner(loadedChart ? `Chart and song ready: ${song.name}. Press play.` : `Song ready: ${song.name}. Press play.`);
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
      state.loadText(await file.text());
      return;
    }
    if (lower.endsWith(".json")) {
      try {
        const data = JSON.parse(await file.text()) as Partial<Record<keyof Meta | "name" | "author" | "scene" | "levelDesigner" | "searchTags" | "bpm", unknown>>;
        const tags = Array.isArray(data.searchTags) ? data.searchTags.map(String).join(", ") : undefined;
        state.patchMeta({
          title: typeof data.name === "string" ? data.name : undefined,
          artist: typeof data.author === "string" ? data.author : undefined,
          genre: typeof data.scene === "string" ? data.scene : undefined,
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-chart text-paper">
      <div className="flex h-8 items-center bg-ink px-3 text-xs text-mute">
        <span className="truncate">
          {(title || "untitled") + ".bms"}
          {songName ? ` — ${songName}` : ""} — Muse Dash Chart Editor
        </span>
      </div>
      <MenuBar
        onOpen={() => bmsInput.current?.click()}
        onSong={() => audioInput.current?.click()}
        onSaveBms={() => download("map2.bms", useChart.getState().exportBms(), "text/plain")}
        onSaveInfo={() => download("info.json", useChart.getState().exportInfo(), "application/json")}
      />
      <div className="flex h-11 items-center gap-2 overflow-x-auto border-b border-dock-line bg-menubar px-2 text-dock-ink">
        <Transport playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <button type="button" className="h-8 rounded border border-dock-line bg-field px-2 text-sm" onClick={() => useChart.getState().undo()}>
          Undo
        </button>
        <button type="button" className="h-8 rounded border border-dock-line bg-field px-2 text-sm" onClick={() => useChart.getState().redo()}>
          Redo
        </button>
        <button type="button" className="h-8 rounded border border-dock-line bg-field px-2 text-sm lg:hidden" onClick={() => setSongOpen(!songOpen)}>
          Panel
        </button>
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
          <div className="lg:hidden">
            <Palette />
          </div>
          {showStage ? <Stage /> : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Roll playheadRef={playheadRef} scrollerRef={scrollerRef} />
          </div>
        </div>
        <aside className="dock hidden w-80 shrink-0 overflow-y-auto border-l border-dock-line p-3 lg:block">
          <Inspector />
        </aside>
      </div>
      <footer className="flex h-7 items-center gap-4 overflow-x-auto border-t border-dock-line bg-menubar px-3 font-mono text-xs text-dock-ink">
        <span>Notes {notes.length}</span>
        <span>Brush {brush}</span>
        <span>{tool === "write" ? "Write" : "Select"}</span>
        <span>{showIcons ? "Icons" : "Labels"}</span>
      </footer>
      {songOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/80 lg:hidden" onClick={() => setSongOpen(false)}>
          <div className="dock max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-dock-line p-4" onClick={(event) => event.stopPropagation()}>
            <Inspector />
            <button type="button" className="mt-4 h-11 w-full rounded bg-dock-ink text-sm font-semibold text-field" onClick={() => setSongOpen(false)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
      <input
        ref={bmsInput}
        type="file"
        accept=".bms,.bme,.bml,.mdm,.md,.zip,.json,.ogg,.mp3,.wav,.flac,.m4a,audio/*,text/plain,application/json"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) void takeFiles(files);
          event.target.value = "";
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*,.ogg,.mp3,.wav"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void takeFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
