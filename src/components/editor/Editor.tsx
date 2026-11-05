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

// TEMP: full file continues in next commit if truncated — see artifacts/FINAL_Editor.tsx
export function Editor() {
  return <div className="p-8 text-paper">Editor restore in progress — redeploy after next push.</div>;
}
