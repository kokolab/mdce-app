import { useEffect, useRef, useState } from "react";
import { GROUPS, NOTES, type NoteGroup } from "@/lib/md/catalog";
import { clearCustomNote, customNoteUrl, loadCustomNotes, setCustomNote, subscribeCustomNotes } from "@/lib/md/customNotes";
import { useChart } from "@/lib/md/store";
import { NoteIcon } from "./NoteIcon";

export function Palette() {
  const brush = useChart((state) => state.brush);
  const showIcons = useChart((state) => state.showIcons);
  const setBrush = useChart((state) => state.setBrush);
  const [group, setGroup] = useState<NoteGroup>("tap");
  const [menu, setMenu] = useState<{ key: string; name: string; x: number; y: number } | null>(null);
  const [, setRev] = useState(0);
  const pending = useRef<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const notes = NOTES.filter((note) => note.group === group);

  useEffect(() => {
    void loadCustomNotes();
    return subscribeCustomNotes(() => setRev((value) => value + 1));
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <section className="flex shrink-0 flex-col gap-2 border-b border-line bg-panel px-3 py-3 lg:w-60 lg:border-r lg:border-b-0">
      <input
        ref={file}
        type="file"
        accept="image/png,.png"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          const key = pending.current;
          event.target.value = "";
          if (!picked || !key) return;
          if (picked.type && picked.type !== "image/png") return;
          void setCustomNote(key, picked);
        }}
      />
      <div className="flex gap-1 overflow-x-auto lg:flex-wrap">
        {GROUPS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setGroup(item.id)}
            className={
              item.id === group
                ? "h-11 shrink-0 rounded-md bg-paper px-3 text-sm font-semibold text-ink"
                : "h-11 shrink-0 rounded-md px-3 text-sm text-mute"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible">
        {notes.map((note) => {
          const on = brush === note.key;
          return (
            <button
              key={note.key}
              type="button"
              title={note.name}
              onClick={() => setBrush(note.key)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ key: note.key, name: note.name, x: event.clientX, y: event.clientY });
              }}
              className={
                "flex h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 font-mono text-xs font-medium " +
                (on ? "border-pink bg-pink text-ink" : "border-line bg-ink text-paper")
              }
            >
              {showIcons ? <NoteIcon noteKey={note.key} className="size-8" /> : null}
              {note.short}
            </button>
          );
        })}
      </div>
      <p className="hidden text-xs text-mute lg:block">Right-click a note to import a PNG. + rises from the floor. − drops from the air.</p>
      {menu ? (
        <div
          className="fixed z-50 min-w-44 border border-line bg-panel py-1 shadow-sm"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="block h-9 w-full px-3 text-left text-sm hover:bg-pink/30"
            onClick={() => {
              pending.current = menu.key;
              setMenu(null);
              file.current?.click();
            }}
          >
            Import PNG for {menu.name}
          </button>
          <button
            type="button"
            className="block h-9 w-full px-3 text-left text-sm hover:bg-pink/30 disabled:text-mute"
            disabled={!customNoteUrl(menu.key)}
            onClick={() => {
              void clearCustomNote(menu.key);
              setMenu(null);
            }}
          >
            Use plain icon
          </button>
        </div>
      ) : null}
    </section>
  );
}
