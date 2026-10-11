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
          className={"h-11 shrink-0 px-4 text-base " + (open === id ? "bg-field text-dock-ink" : "text-dock-ink")}
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

  return (
    <div
      ref={barRef}
      className="relative z-50 flex h-11 items-stretch overflow-x-auto border-b border-dock-line bg-menubar lg:h-8"
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
        {item("Save BMS", onSaveBms)}
        {item("Save info.json", onSaveInfo)}
      </>)}
      {menu("edit", "Edit", <>
        {item("Undo", () => state().undo())}
        {item("Redo", () => state().redo())}
        {item("Copy", () => state().copySelected())}
        {item("Paste", () => state().pasteClipboard())}
        {item("Delete", () => {
          const id = state().selectedId;
          if (id) state().remove(id);
        })}
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
        {item("Horizontal view", () => undefined, true)}
      </>)}
      {menu("options", "Options", <>
        {item("Snap to grid", () => state().setSnapOn(!snapOn), snapOn)}
        {item("Disable vertical moves", () => state().setLockLane(!lockLane), lockLane)}
        {item("Write tool", () => state().setTool("write"), tool === "write")}
        {item("Select tool", () => state().setTool("select"), tool === "select")}
      </>)}
      {menu("convert", "Conversion", <>
        {item("Swap air and ground", () => state().swapGroundAir())}
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
      </>)}
      {menu("about", "About", <>
        {item("BMS chart editor", () => state().setBanner("Browser chart editor for Muse Dash BMS files. Note chips are original."))}
      </>)}
    </div>
  );
}
