import { useState } from "react";
import { GROUPS, NOTES, type NoteGroup } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";
import { NoteIcon } from "./NoteIcon";

export function Palette() {
  const brush = useChart((state) => state.brush);
  const showIcons = useChart((state) => state.showIcons);
  const setBrush = useChart((state) => state.setBrush);
  const [group, setGroup] = useState<NoteGroup>("tap");
  const notes = NOTES.filter((note) => note.group === group);

  return (
    <section className="flex shrink-0 flex-col gap-2 border-b border-line bg-panel px-3 py-3 lg:w-60 lg:border-r lg:border-b-0">
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
      <p className="hidden text-xs text-mute lg:block">+ rises from the floor. − drops from the air. Gemini places both lanes.</p>
    </section>
  );
}
