import { useEffect } from "react";

const ROWS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / Stop" },
  { keys: "Ctrl/Cmd + S", action: "Save or download BMS" },
  { keys: "Ctrl/Cmd + Z", action: "Undo" },
  { keys: "Ctrl/Cmd + Shift + Z / Y", action: "Redo" },
  { keys: "Ctrl/Cmd + C / V", action: "Copy / Paste selection" },
  { keys: "Delete / Backspace", action: "Delete selection" },
  { keys: "Arrow keys", action: "Nudge selection" },
  { keys: "[ / ]", action: "Grid divide finer / coarser" },
  { keys: "Ctrl/Cmd + ↑ / ↓", action: "Playback speed" },
  { keys: "G", action: "Snap to grid (Options)" },
  { keys: "D", action: "Lock vertical moves (Options)" },
  { keys: "?", action: "This shortcuts panel" },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85dvh] w-full max-w-md overflow-auto rounded border border-dock-line bg-field shadow-xl">
        <div className="flex h-10 items-center justify-between border-b border-dock-line px-3">
          <span className="text-sm font-medium text-dock-ink">Keyboard shortcuts</span>
          <button type="button" className="h-7 rounded border border-dock-line bg-menubar px-2.5 text-xs text-dock-ink" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="divide-y divide-dock-line px-0 py-1 text-sm text-dock-ink">
          {ROWS.map((row) => (
            <li key={row.keys} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <kbd className="shrink-0 rounded border border-dock-line bg-chart px-1.5 py-0.5 font-mono text-xs text-paper">{row.keys}</kbd>
              <span className="min-w-0 flex-1 text-right text-xs text-mute">{row.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
