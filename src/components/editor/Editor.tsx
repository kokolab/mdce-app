import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chartLabel, readAlbum } from "@/lib/md/album";
import { chartOrigin, currentChartName, setAlbumCharts, setChartOrigin, useAlbumCharts } from "@/lib/md/pack";
import { declaredScene, musicFileName, rememberInfo, type Meta } from "@/lib/md/bms";
import { isGearNote, isPlayNote, normalizeScene, sceneFromNotes } from "@/lib/md/catalog";
import { applyLinkedMusic, bootMusic } from "@/lib/md/musicLink";
import { isChartDirty, persistChart, restoreChart, useChart } from "@/lib/md/store";
import { NotePicker } from "./NotePicker";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar } from "./MenuBar";
import { Transport } from "./Transport";
import { Stage } from "./Stage";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { FolderPicker } from "./FolderPicker";
import { SongCard } from "./SongCard";
import { EditorChrome } from "./EditorChrome";
import { loadChartFolder } from "@/lib/md/chartFolder";

export function Editor() {
  const songOpen = useChart((s) => s.songOpen);
  const setSongOpen = useChart((s) => s.setSongOpen);
  const showStage = useChart((s) => s.showStage);
  const banner = useChart((s) => s.banner);
  const confirmNew = useChart((s) => s.confirmNew);
  const reset = useChart((s) => s.reset);
  const loadText = useChart((s) => s.loadText);
  const exportBms = useChart((s) => s.exportBms);
  const exportInfo = useChart((s) => s.exportInfo);
  const meta = useChart((s) => s.meta);
  const notes = useChart((s) => s.notes);
  const songName = useChart((s) => s.songName);
  const setSongName = useChart((s) => s.setSongName);
  const setBanner = useChart((s) => s.setBanner);
  const patchMeta = useChart((s) => s.patchMeta);
  const albumCharts = useAlbumCharts();

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);

  useEffect(() => {
    restoreChart();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isChartDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setShortcuts((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function takeFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const bms = list.find((f) => /\.bms$/i.test(f.name) || /\.bme$/i.test(f.name) || /\.bml$/i.test(f.name));
    const info = list.find((f) => /info\.json$/i.test(f.name));
    const audio = list.find((f) => /\.(ogg|mp3|wav|flac|m4a)$/i.test(f.name));
    if (bms) {
      const text = await bms.text();
      loadText(text, bms.name);
      setChartOrigin(bms.name);
      if (info) {
        try {
          const j = JSON.parse(await info.text());
          rememberInfo(j);
          if (j.title) patchMeta({ title: j.title });
          if (j.artist) patchMeta({ artist: j.artist });
          if (j.designer) patchMeta({ designer: j.designer });
        } catch {}
      }
      if (audio) {
        setSongName(audio.name);
        void applyLinkedMusic(audio);
      }
    } else if (audio) {
      setSongName(audio.name);
      void applyLinkedMusic(audio);
    }
  }

  async function takeFile(file: File) {
    if (/\.(ogg|mp3|wav|flac|m4a)$/i.test(file.name)) {
      setSongName(file.name);
      void applyLinkedMusic(file);
    }
  }

  function download(name: string, text: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    persistChart();
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <MenuBar
        onOpen={() => fileInput.current?.click()}
        onOpenAudio={() => audioInput.current?.click()}
        onNew={() => {
          if (isChartDirty() && !confirm("Discard unsaved chart?")) return;
          reset();
        }}
        onSaveBms={() => download(currentChartName() || "chart.bms", exportBms())}
        onSaveInfo={() => download("info.json", exportInfo())}
        onFolder={() => setFolderOpen(true)}
        onShortcuts={() => setShortcuts(true)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Transport />
          <div className="relative min-h-0 flex-1">
            <Roll />
            {showStage && <Stage />}
          </div>
          <div className="border-t border-zinc-800 px-3 py-1 text-xs text-zinc-400">{banner}</div>
        </div>
        <Inspector />
      </div>
      {songOpen && <SongCard onClose={() => setSongOpen(false)} />}
      {shortcuts && <ShortcutsOverlay onClose={() => setShortcuts(false)} />}
      {folderOpen && (
        <FolderPicker
          onClose={() => setFolderOpen(false)}
          onPick={async (handle) => {
            const result = await loadChartFolder(handle);
            if (result) {
              loadText(result.bms, result.name);
              if (result.info) rememberInfo(result.info);
              if (result.audio) {
                setSongName(result.audio.name);
                void applyLinkedMusic(result.audio);
              }
            }
            setFolderOpen(false);
          }}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".bms,.bme,.bml,application/json,audio/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const file = event.target.files;
          event.target.value = "";
          if (file) void takeFiles(file);
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
