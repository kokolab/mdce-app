import { useEffect } from "react";
import { NOTE_BY_KEY } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";
import { BossBadge, NoteIcon, bossMark } from "./NoteIcon";

const PICKER: { title: string; groups: { title: string; keys: string[] }[] }[] = [
  {
    title: "Notes",
    groups: [
      { title: "Taps", keys: ["01", "02", "03", "04", "05", "06", "07", "08", "09"] },
      { title: "Accents", keys: ["0A", "0B", "0C", "0I", "0D", "0J", "0E"] },
      { title: "Holds", keys: ["0F", "0G", "0H"] },
      { title: "Boss", keys: ["11", "12", "13", "14", "15", "16", "17", "18"] },
      { title: "Items", keys: ["20", "21", "22", "23"] },
    ],
  },
  {
    title: "Speed",
    groups: [
      { title: "Both lanes", keys: ["0O", "0P", "0Q"] },
      { title: "Ground", keys: ["0R", "0S", "0T"] },
      { title: "Air", keys: ["0U", "0V", "0W"] },
    ],
  },
  {
    title: "Effects",
    groups: [
      { title: "Music", keys: ["10"] },
      { title: "Bullets", keys: ["34", "30", "38"] },
      { title: "Boss", keys: ["1A", "1B", "1C", "1D", "1E", "1F", "1G", "1H"] },
      { title: "Visibility", keys: ["1J", "1K", "1L", "1M", "25", "26"] },
      { title: "Scenes", keys: ["1O", "1P", "1Q", "1R", "1S", "1T", "1U", "1V", "1W", "1X"] },
      { title: "Playback", keys: ["2Y", "2Z"] },
    ],
  },
];

export function NotePicker({ onClose }: { onClose: () => void }) {
  const brush = useChart((state) => state.brush);
  const current = NOTE_BY_KEY[brush];

  useEffect(() => {
    document.querySelector<HTMLElement>("[data-brush-on]")?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-dock-line bg-panel text-dock-ink lg:flex">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-dock-line px-2">
        <span className="text-sm font-semibold">Notes</span>
        <button type="button" className="h-7 rounded border border-dock-line bg-field px-2 text-xs" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="shrink-0 truncate border-b border-dock-line px-2 py-1 text-xs text-mute">{current ? current.name : brush}</p>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {PICKER.map((section) => (
          <section key={section.title}>
            <h2 className="sticky top-0 z-10 bg-panel px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-mute uppercase">{section.title}</h2>
            {section.groups.map((group) => (
              <div key={group.title}>
                <h3 className="px-2 pt-1.5 pb-0.5 text-[11px] text-dock-ink">{group.title}</h3>
                {group.keys.map((key) => {
                  const note = NOTE_BY_KEY[key];
                  if (!note) return null;
                  const on = brush === key;
                  const mark = bossMark(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      data-brush-on={on ? "" : undefined}
                      onClick={() => useChart.getState().setBrush(key)}
                      className={"flex h-8 w-full items-center gap-2 px-2 text-left text-xs " + (on ? "bg-pink text-ink" : "hover:bg-field")}
                    >
                      <span className="relative grid size-6 shrink-0 place-items-center">
                        <NoteIcon noteKey={key} className="size-6" />
                        {mark ? <BossBadge text={mark} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{note.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
