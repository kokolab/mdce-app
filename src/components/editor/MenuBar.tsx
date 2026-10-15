import { useEffect, useRef, useState, type ReactNode } from "react";
import { chartIssues } from "@/lib/md/bms";
import { useChart } from "@/lib/md/store";

type MenuId = "file" | "edit" | "view" | "options" | "convert" | "preview" | "tools" | "about";

export function MenuBar({
  onOpen,
  onSong,
  onSaveBms,
  onSaveInfo,
}: {
  onOpen: () => void;
  onSong: () => void;
  onSaveBms: () => void;
  onSaveInfo: () => void;
}) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, left: 0, moved: false, id: "" });
  const tool = useChart((state) => state.tool);
  const showIcons = useChart((state) => state.showIcons);
  const showStage = useChart((state) => state.showStage);
  const snapOn = useChart((state) => state.snapOn);
  const lockLane = useChart((state) => state.lockLane);
  const followPlay = useChart((state) => state.followPlay);
  const followTight = useChart((state) => state.followTight);
  const [dark, setDark] = useState(() => typeof localStorage === "undefined" || localStorage.getItem("stagepen-dark") !== "0");

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const node = event.target;
      if (node instanceof Node && barRef.current?.contains(node)) return;
      setOpen(null);
    };
    const timer = window.setTimeout(() => window.addEventListener("pointerdown", close), 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

  function item(label: string, action: () => void, mark?: boolean) {
    return (
      <button
        type="button"
        className="flex h-12 w-full touch-manipulation items-center justify-between px-3 text-left text-base text-dock-ink"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(null);
          action();
        }}
      >
        <span>{label}</span>
        {mark ? <span aria-hidden>✓</span> : null}
      </button>
    );
  }

  function menu(id: MenuId, label: string, children: ReactNode) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          data-menu={id}
          className={"flex h-full shrink-0 items-center px-3 text-sm " + (open === id ? "bg-field text-dock-ink" : "text-dock-ink")}
          style={{ touchAction: "none" }}
        >
          {label}
        </button>
        {open === id ? (
          <div
            data-menu-panel
            className="fixed z-[80] max-h-[70dvh] min-w-56 overflow-y-auto border border-dock-line bg-field py-1 shadow-lg"
            style={{ top: anchor.top, left: anchor.left, touchAction: "pan-y" }}
          >
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  const state = useChart.getState;

  function zoom(dir: number) {
    state().setXWidth(state().xWidth + dir * 0.5);
    state().setBanner(dir > 0 ? "Zoomed in." : "Zoomed out.");
  }

  function jump() {
    const raw = window.prompt("Go to this measure", "0");
    if (raw == null) return;
    const measure = Number(raw) || 0;
    state().gotoMeasure(measure);
    state().setBanner(`Jumped to measure ${measure}.`);
  }

  return (
    <div
      ref={barRef}
      className="relative z-50 hidden h-8 items-stretch overflow-x-auto border-b border-dock-line bg-menubar lg:flex"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-menu-panel]")) return;
        if (event.pointerType === "touch") event.preventDefault();
        drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false, id: "" };
        const button = (event.target as HTMLElement).closest<HTMLElement>("[data-menu]");
        if (button) drag.current.id = button.dataset.menu ?? "";
      }}
      onPointerMove={(event) => {
        if ((event.target as HTMLElement).closest("[data-menu-panel]")) return;
        const dx = event.clientX - drag.current.x;
        if (Math.abs(dx) > 12) drag.current.moved = true;
        if (drag.current.moved) event.currentTarget.scrollLeft = drag.current.left - dx;
      }}
      onPointerUp={(event) => {
        if ((event.target as HTMLElement).closest("[data-menu-panel]")) return;
        const id = drag.current.id as MenuId;
        const moved = drag.current.moved;
        drag.current = { x: 0, left: 0, moved: false, id: "" };
        if (moved || !id) return;
        const button = barRef.current?.querySelector<HTMLElement>(`[data-menu="${id}"]`);
        const rect = button?.getBoundingClientRect();
        if (!rect) return;
        setAnchor({ top: rect.bottom, left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)) });
        setOpen(open === id ? null : id);
      }}
    >
      {menu("file", "File", <>
        {item("New", () => state().reset())}
        {item("Open chart…", onOpen)}
        {item("Open song…", onSong)}
        {item("Save BMS", () => {
          onSaveBms();
          state().setBanner("Downloaded the BMS file.");
        })}
        {item("Save info.json", () => {
          onSaveInfo();
          state().setBanner("Downloaded info.json.");
        })}
      </>)}
      {menu("edit", "Edit", <>
        {item("Undo", () => state().undo())}
        {item("Redo", () => state().redo())}
        {item("Cut", () => state().cutSelected())}
        {item("Copy", () => state().copySelected())}
        {item("Paste", () => state().pasteClipboard())}
        {item("Delete", () => state().deleteSelection())}
        {item("Select all", () => state().selectAll())}
      </>)}
      {menu("view", "View", <>
        {item("Note icons", () => state().setShowIcons(!showIcons), showIcons)}
        {item("Dark mode", () => {
          const next = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", next);
          localStorage.setItem("stagepen-dark", next ? "1" : "0");
          setDark(next);
        }, dark)}
        {item("Stage preview", () => state().setShowStage(!showStage), showStage)}
        {item("Follow play line", () => state().setFollowPlay(!followPlay), followPlay)}
        {item("Keep play line tight", () => state().setFollowTight(!followTight), followTight)}
        {item("Zoom in", () => zoom(1))}
        {item("Zoom out", () => zoom(-1))}
        {item("Go to measure…", jump)}
      </>)}
      {menu("options", "Options", <>
        {item("Snap to grid", () => state().setSnapOn(!snapOn), snapOn)}
        {item("Disable vertical moves", () => state().setLockLane(!lockLane), lockLane)}
        {item("Write tool", () => state().setTool("write"), tool === "write")}
        {item("Select tool", () => state().setTool("select"), tool === "select")}
      </>)}
      {menu("convert", "Conversion", <>
        {item("Swap air and ground", () => state().swapGroundAir())}
        {item("Swap upper and lower lanes", () => state().mirrorLanes())}
        {item("Quantize selection", () => state().quantizeSelection())}
      </>)}
      {menu("preview", "Preview", <>
        {item("Play or pause", () => {
          document.dispatchEvent(new CustomEvent("stagepen-toggle-play"));
        })}
        {item("Stop", () => {
          document.dispatchEvent(new CustomEvent("stagepen-stop"));
        })}
      </>)}
      {menu("tools", "Tools", <>
        {item("Find current note", () => state().findBrush())}
        {item("Insert measure…", () => {
          const raw = window.prompt("Insert an empty measure before this number", "0");
          if (raw == null) return;
          state().insertMeasure(Number(raw) || 0);
        })}
        {item("Remove measure…", () => {
          const raw = window.prompt("Remove this measure number. Notes inside it are deleted.", "0");
          if (raw == null) return;
          state().removeMeasure(Number(raw) || 0);
        })}
        {item("Error check", () => {
          const found = chartIssues(state().notes, state().sigs);
          const first = found[0];
          if (!first) {
            state().setBanner("No chart problems found.");
            return;
          }
          useChart.getState().revealNotes(first.ids);
          state().setBanner(first.text);
        })}
        {item("Count notes", () => state().setBanner(`${state().notes.length} notes in this chart.`))}
      </>)}
      {menu("about", "About", <>
        {item("Chart info", () => {
          const chart = state();
          state().setBanner(`${chart.meta.title || "Untitled"} · ${chart.meta.chartDifficulty || "hard"} · ${chart.notes.length} notes · ${Math.round(chart.meta.bpm)} BPM`);
        })}
      </>)}
    </div>
  );
}

export function MobileMenu({
  onOpen,
  onSong,
  onSaveBms,
  onSaveInfo,
}: {
  onOpen: () => void;
  onSong: () => void;
  onSaveBms: () => void;
  onSaveInfo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bar, setBar] = useState("0");
  const [dark, setDark] = useState(() => typeof localStorage === "undefined" || localStorage.getItem("stagepen-dark") !== "0");
  const tool = useChart((state) => state.tool);
  const showIcons = useChart((state) => state.showIcons);
  const showStage = useChart((state) => state.showStage);
  const snapOn = useChart((state) => state.snapOn);
  const lockLane = useChart((state) => state.lockLane);
  const followPlay = useChart((state) => state.followPlay);
  const followTight = useChart((state) => state.followTight);
  const state = useChart.getState;

  function go(action: () => void) {
    setOpen(false);
    action();
  }

  function row(label: string, action: () => void, mark?: boolean) {
    return (
      <button type="button" className="flex h-12 w-full items-center justify-between border-b border-white/10 px-4 text-left text-base" onClick={() => go(action)}>
        <span>{label}</span>
        {mark ? <span aria-hidden>✓</span> : null}
      </button>
    );
  }

  return (
    <>
      <button type="button" className="h-10 shrink-0 rounded border border-dock-line bg-field px-3 text-sm" onClick={() => setOpen(true)}>
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-ink text-paper">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
            <span className="text-base font-semibold">Menu</span>
            <button type="button" className="h-10 rounded border border-white/20 px-3" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            <form
              className="flex items-center gap-2 border-b border-white/10 px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                state().gotoMeasure(Number(bar) || 0);
                setOpen(false);
              }}
            >
              <label className="text-sm" htmlFor="jump-bar">
                Go to bar
              </label>
              <input id="jump-bar" inputMode="numeric" value={bar} onChange={(event) => setBar(event.target.value)} className="h-11 w-20 rounded border border-white/20 bg-chart px-2 text-center font-mono" />
              <button type="submit" className="h-11 rounded bg-paper px-4 text-sm font-semibold text-ink">
                Go
              </button>
            </form>
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">File</p>
            {row("New", () => state().reset())}
            {row("Open chart…", onOpen)}
            {row("Open song…", onSong)}
            {row("Save BMS", () => {
              onSaveBms();
              state().setBanner("Downloaded the BMS file.");
            })}
            {row("Save info.json", () => {
              onSaveInfo();
              state().setBanner("Downloaded info.json.");
            })}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Edit</p>
            {row("Undo", () => state().undo())}
            {row("Redo", () => state().redo())}
            {row("Cut", () => state().cutSelected())}
            {row("Copy", () => state().copySelected())}
            {row("Paste", () => state().pasteClipboard())}
            {row("Delete", () => state().deleteSelection())}
            {row("Select all", () => state().selectAll())}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">View</p>
            {row("Note icons", () => state().setShowIcons(!showIcons), showIcons)}
            {row("Dark mode", () => {
              const next = !document.documentElement.classList.contains("dark");
              document.documentElement.classList.toggle("dark", next);
              localStorage.setItem("stagepen-dark", next ? "1" : "0");
              setDark(next);
            }, dark)}
            {row("Stage preview", () => state().setShowStage(!showStage), showStage)}
            {row("Follow play line", () => state().setFollowPlay(!followPlay), followPlay)}
            {row("Keep play line tight", () => state().setFollowTight(!followTight), followTight)}
            {row("Zoom in", () => state().setXWidth(state().xWidth + 0.5))}
            {row("Zoom out", () => state().setXWidth(state().xWidth - 0.5))}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Options</p>
            {row("Snap to grid", () => state().setSnapOn(!snapOn), snapOn)}
            {row("Disable vertical moves", () => state().setLockLane(!lockLane), lockLane)}
            {row("Write tool", () => state().setTool("write"), tool === "write")}
            {row("Select tool", () => state().setTool("select"), tool === "select")}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Conversion</p>
            {row("Swap air and ground", () => state().swapGroundAir())}
            {row("Swap upper and lower lanes", () => state().mirrorLanes())}
            {row("Quantize selection", () => state().quantizeSelection())}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Preview</p>
            {row("Play or pause", () => document.dispatchEvent(new CustomEvent("stagepen-toggle-play")))}
            {row("Stop", () => document.dispatchEvent(new CustomEvent("stagepen-stop")))}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Tools</p>
            {row("Find current note", () => state().findBrush())}
            {row("Insert measure…", () => {
              const raw = window.prompt("Insert an empty measure before this number", "0");
              if (raw == null) return;
              state().insertMeasure(Number(raw) || 0);
            })}
            {row("Remove measure…", () => {
              const raw = window.prompt("Remove this measure number. Notes inside it are deleted.", "0");
              if (raw == null) return;
              state().removeMeasure(Number(raw) || 0);
            })}
            {row("Error check", () => {
              const found = chartIssues(state().notes, state().sigs);
              const first = found[0];
              if (!first) {
                state().setBanner("No chart problems found.");
                return;
              }
              state().revealNotes(first.ids);
              state().setBanner(first.text);
            })}
            {row("Count notes", () => state().setBanner(`${state().notes.length} notes in this chart.`))}
            {row("Chart info", () => {
              const chart = state();
              state().setBanner(`${chart.meta.title || "Untitled"} · ${chart.meta.chartDifficulty || "hard"} · ${chart.notes.length} notes · ${Math.round(chart.meta.bpm)} BPM`);
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
