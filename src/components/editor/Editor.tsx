import { useEffect, useRef, useState } from "react";
import { rememberInfo } from "@/lib/md/bms";
import { applyLinkedMusic } from "@/lib/md/musicLink";
import { isChartDirty, persistChart, restoreChart, useChart } from "@/lib/md/store";
import { currentChartName, setChartOrigin } from "@/lib/md/pack";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar, MobileMenu } from "./MenuBar";
import { Transport } from "./Transport";
import { Stage } from "./Stage";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { SongCard } from "./SongCard";

export function Editor() {
  const songOpen = useChart((s) => s.songOpen);
  const setSongOpen = useChart((s) => s.setSongOpen);
  const showStage = useChart((s) => s.showStage);
  const banner = useChart((s) => s.banner);
  const loadText = useChart((s) => s.loadText);
  const exportBms = useChart((s) => s.exportBms);
  const exportInfo = useChart((s) => s.exportInfo);
  const setSongName = useChart((s) => s.setSongName);
  const patchMeta = useChart((s) => s.patchMeta);
  const setBanner = useChart((s) => s.setBanner);

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [shortcuts, setShortcuts] = useState(false);

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
          if (typeof j.name === "string") patchMeta({ title: j.name });
          if (typeof j.author === "string") patchMeta({ artist: j.author });
          if (typeof j.levelDesigner === "string") patchMeta({ designer: j.levelDesigner });
        } catch {
          /* ignore */
        }
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

  const menuProps = {
    onOpen: () => fileInput.current?.click(),
    onSong: () => audioInput.current?.click(),
    onLinkFolder: () => setBanner("Link folder needs the full editor restore — use Load mdm/bms for now."),
    onSaveBms: () => download(currentChartName() || "chart.bms", exportBms()),
    onSaveInfo: () => download("info.json", exportInfo()),
    onShortcuts: () => setShortcuts(true),
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <MenuBar {...menuProps} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-2 py-1 lg:hidden">
            <MobileMenu {...menuProps} />
          </div>
          <Transport playheadRef={playheadRef} scrollerRef={scrollerRef} />
          <div className="relative min-h-0 flex-1">
            <Roll playheadRef={playheadRef} scrollerRef={scrollerRef} />
            {showStage && <Stage />}
          </div>
          <div className="border-t border-zinc-800 px-3 py-1 text-xs text-zinc-400">{banner}</div>
        </div>
        <Inspector />
      </div>
      {songOpen && <SongCard onClose={() => setSongOpen(false)} />}
      {shortcuts && <ShortcutsOverlay onClose={() => setShortcuts(false)} />}
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
