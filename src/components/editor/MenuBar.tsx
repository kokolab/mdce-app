import { useEffect, useState, type ReactNode } from "react";
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
  const tool = useChart((state) => state.tool);
  const showIcons = useChart((state) => state.showIcons);
  const showStage = useChart((state) => state.showStage);
  const snapOn = useChart((state) => state.snapOn);
  const lockLane = useChart((state) => state.lockLane);
  const followPlay = useChart((state) => state.followPlay);
  const [dark, setDark] = useState(() => typeof localStorage === "undefined" || localStorage.getItem("stagepen-dark") !== "0");

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function item(label: string, action: () => void, mark?: boolean) {
    return (
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between px-3 text-left text-sm text-dock-ink hover:bg-pink/30"
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
      <div className="relative" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={"h-8 px-3 text-sm " + (open === id ? "bg-field text-dock-ink" : "text-dock-ink")}
          onClick={() => setOpen(open === id ? null : id)}
        >
          {label}
        </button>
        {open === id ? <div className="absolute left-0 z-40 min-w-52 border border-dock-line bg-field py-1 shadow-sm">{children}</div> : null}
      </div>
    );
  }

  const state = useChart.getState;

  return (
    <div className="flex h-8 items-stretch border-b border-dock-line bg-menubar">
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
