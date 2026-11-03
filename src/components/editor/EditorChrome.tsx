import { currentChartName, useChartOrigin } from "@/lib/md/pack";
import { syncedSongName } from "@/lib/md/chartFolder";

export type EditorMode = {
  origin: ReturnType<typeof useChartOrigin>;
  linked: boolean;
  label: string;
  saveLabel: string;
};

export function useEditorMode(): EditorMode {
  const origin = useChartOrigin();
  const syncName = syncedSongName();
  const linked = origin === "linked";
  const label =
    origin === "linked"
      ? syncName
        ? `Linked · ${syncName}`
        : "Linked folder"
      : origin === "mdm"
        ? "Pack · mdm"
        : origin === "loose"
          ? `File · ${currentChartName()}`
          : "No chart";
  return {
    origin,
    linked,
    label,
    saveLabel: linked ? "Save" : "Download",
  };
}

export function ModeBadge({ mode }: { mode: EditorMode }) {
  const color = mode.linked
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
    : mode.origin === "mdm" || mode.origin === "loose"
      ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
      : "border-dock-line bg-field text-mute";
  return (
    <span className={"shrink-0 rounded border px-1.5 py-0.5 text-[11px] tabular-nums " + color} title={mode.label}>
      {mode.label}
    </span>
  );
}

export function SaveButton({
  mode,
  onSave,
  compact = false,
}: {
  mode: EditorMode;
  onSave: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        (compact ? "h-10 " : "h-8 ") +
        "shrink-0 rounded border px-3 text-sm font-medium " +
        (mode.linked
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
          : "border-dock-line bg-field text-dock-ink")
      }
      title={mode.linked ? "Save BMS to the linked folder (Ctrl+S)" : "Download the current BMS file (Ctrl+S)"}
      onClick={onSave}
    >
      {mode.saveLabel}
    </button>
  );
}

export function StatusBar({
  playNotes,
  gearNotes,
  mode,
  songName,
  banner,
  saved,
}: {
  playNotes: number;
  gearNotes: number;
  mode: EditorMode;
  songName: string;
  banner: string;
  saved: string;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-dock-line bg-ink px-3 text-xs text-mute">
      <span className="shrink-0 tabular-nums text-dock-ink">
        {playNotes} note{playNotes === 1 ? "" : "s"}
        {" · "}
        {gearNotes} gear{gearNotes === 1 ? "" : "s"}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-center tabular-nums"
        title={mode.label + (songName ? ` · ${songName}` : "")}
      >
        {mode.label}
        {songName ? ` · ${songName}` : ""}
        {banner ? ` · ${banner}` : ""}
      </span>
      <span className="shrink-0 tabular-nums text-dock-ink">{saved}</span>
    </footer>
  );
}
