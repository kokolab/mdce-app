import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chartLabel, readAlbum } from "@/lib/md/album";
import { chartOrigin, currentChartName, setAlbumCharts, setChartOrigin, useAlbumCharts } from "@/lib/md/pack";
import { declaredScene, musicFileName, rememberInfo, type Meta } from "@/lib/md/bms";
import { isGearNote, isPlayNote, normalizeScene, sceneFromNotes } from "@/lib/md/catalog";
import { player } from "@/lib/md/player";
import { linkChartFolder, listLinkedCharts, pickDefaultChart, serverCharts, setSyncedSongName, syncedSongName, writeChartFile } from "@/lib/md/chartFolder";
import { applyLinkedMusic, bootMusic } from "@/lib/md/musicLink";
import { isChartDirty, persistChart, restoreChart, useChart } from "@/lib/md/store";
import { NotePicker } from "./NotePicker";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar, MobileMenu } from "./MenuBar";
import { Transport } from "./Transport";
import { FolderPicker } from "./FolderPicker";
import { ModeBadge, SaveButton, StatusBar, useEditorMode } from "./EditorChrome";
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

export function EditorApp() {
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
  const mode = useEditorMode();
  let playNotes = 0;
  let gearNotes = 0;
  for (const note of notes) {
    if (isPlayNote(note.key)) {
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
        state.loadText(pack.bmsText, pack.bmsName);
        setAlbumCharts(pack.charts, pack.bmsName);
        setChartOrigin("mdm");
        loadedChart = true;
        if (pack.infoText) await takeFile(new File([pack.infoText], "info.json", { type: "application/json" }));
        if (pack.music) {
          state.setSongName(pack.music.name);
          void applyLinkedMusic(pack.music);
        }
        state.setBanner(`Opened pack · ${pack.bmsName}`);
      } else if (/\.(bms|bme|bml)$/i.test(lower)) {
        const text = await file.text();
        state.loadText(text, file.name);
        setAlbumCharts([], "");
        setChartOrigin("loose");
        loadedChart = true;
        state.setBanner(`Opened ${file.name}`);
      } else if (/info\.json$/i.test(lower) || lower.endsWith(".json")) {
        await takeFile(file);
      } else if (/\.(ogg|mp3|wav|flac|m4a)$/i.test(lower)) {
        audio.push(file);
      }
    }
    const chart = useChart.getState();
    const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
    if (wanted && audio.length) {
      const match = audio.find((f) => f.name.toLowerCase() === wanted.toLowerCase()) ?? audio[0];
      chart.setSongName(match.name);
      void applyLinkedMusic(match);
    } else if (audio.length && !loadedChart) {
      chart.setSongName(audio[0].name);
      void applyLinkedMusic(audio[0]);
    }
  }

  async function takeFile(file: File) {
    const lower = file.name.toLowerCase();
    const state = useChart.getState();
    if (/\.(ogg|mp3|wav|flac|m4a)$/i.test(lower)) {
      state.setSongName(file.name);
      void applyLinkedMusic(file);
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
      const text = await file.text();
      state.loadText(text, file.name);
      setAlbumCharts([], "");
      setChartOrigin("loose");
      state.setBanner(`Opened ${file.name}`);
      return;
    }
    if (/\.(mdm|md|zip)$/i.test(lower)) {
      await takeFiles([file]);
    }
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
      } else if (wrote === "stale") {
        showDiskStatus("Write stale", 4000);
      } else if (wrote === "denied") {
        showDiskStatus("Write denied", 5000);
      } else {
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
    const useDisk =
      origin === "linked" || (origin !== "mdm" && origin !== "loose" && Boolean(syncedSongName()));
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
      const { enabled, folders } = await serverCharts();
      if (!enabled) {
        state.setBanner("Chart folder server is offline.");
        return;
      }
      if (!folders.length) {
        state.setBanner("No song folders yet. Extract a .mdm into Custom_Albums first.");
        return;
      }
      const current = syncedSongName() || "";
      const initial = current && folders.includes(current) ? current : folders[0];
      setFolderPick(initial);
      setFolderPicker({ folders, current });
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
      const linked = await linkChartFolder(pick);
      if (!linked) {
        state.setBanner(`Could not link ${pick}`);
        return;
      }
      setSyncedSongName(pick);
      setChartOrigin("linked");
      const charts = await listLinkedCharts();
      const next = pickDefaultChart(charts);
      if (!next) {
        setAlbumCharts([], "");
        state.setBanner(`Linked ${pick} (no BMS found)`);
        return;
      }
      state.loadText(next.text, next.name);
      setAlbumCharts(charts, next.name);
      state.setBanner(`Editing ${chartLabel(next.name)}.`);
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

  return (
    <div
      className="flex h-dvh flex-col bg-ink text-paper"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        void collectDropped(event.dataTransfer).then((files) => takeFiles(files));
      }}
    >
      <MenuBar
        onOpen={() => bmsInput.current?.click()}
        onSong={() => audioInput.current?.click()}
        onLinkFolder={() => void linkFolder()}
        onSaveBms={() => void saveBms()}
        onSaveInfo={() => void saveInfo()}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="flex h-12 items-center gap-1.5 border-b border-dock-line bg-menubar px-2 text-dock-ink lg:hidden">
        <MobileMenu
          onOpen={() => bmsInput.current?.click()}
          onSong={() => audioInput.current?.click()}
          onLinkFolder={() => void linkFolder()}
          onSaveBms={() => void saveBms()}
          onSaveInfo={() => void saveInfo()}
          onShortcuts={() => setShortcutsOpen(true)}
        />
        <ModeBadge mode={mode} />
        <SaveButton mode={mode} onSave={() => void saveBms()} compact />
      </div>
      <div className="hidden h-11 items-center gap-2 overflow-x-auto border-b border-dock-line bg-menubar px-2 text-dock-ink lg:flex">
        <Transport playheadRef={playheadRef} scrollerRef={scrollerRef} />
        <ModeBadge mode={mode} />
        <SaveButton mode={mode} onSave={() => void saveBms()} />
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
        <span className="ml-auto shrink-0 text-mute">Stagepen</span>
      </div>
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
              <Inspector />
            )}
          </aside>
        ) : null}
      </div>
      <StatusBar playNotes={playNotes} gearNotes={gearNotes} mode={mode} songName={songName} banner={banner} saved={saved} />
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
            <Inspector />
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
            setSyncedSongName("");
            setChartOrigin("");
            setFolderPicker(null);
            useChart.getState().setBanner("Unlinked chart folder.");
          }}
          onCancel={() => setFolderPicker(null)}
        />
      ) : null}
      {shortcutsOpen ? <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} /> : null}
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
