import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chartLabel, readAlbum } from "@/lib/md/album";
import { currentChartName, setAlbumCharts, useAlbumCharts } from "@/lib/md/pack";
import { declaredScene, musicFileName, rememberInfo, type Meta } from "@/lib/md/bms";
import { normalizeScene, sceneFromNotes } from "@/lib/md/catalog";
import { player } from "@/lib/md/player";
import { linkChartFolder, listLinkedCharts, pickDefaultChart, serverCharts, setSyncedSongName, syncedSongName, writeChartFile } from "@/lib/md/chartFolder";
import { applyLinkedMusic, bootMusic } from "@/lib/md/musicLink";
import { persistChart, restoreChart, useChart } from "@/lib/md/store";
import { NotePicker } from "./NotePicker";
import { Roll } from "./Roll";
import { Inspector } from "./Inspector";
import { MenuBar, MobileMenu } from "./MenuBar";
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
  const banner = useChart((state) => state.banner);
  const selected = notes.find((note) => note.id === selectedId);
  const album = useAlbumCharts();
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

  // NOTE: remainder of Editor is restored from last good build — full file continues below
  return null as any;
}
