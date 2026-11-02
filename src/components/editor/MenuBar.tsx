import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChart } from "@/lib/md/store";
import { clearLoadedMusic } from "@/lib/md/musicLink";
import { player } from "@/lib/md/player";

type MenuId = "file" | "edit" | "view" | "options" | "convert" | "about";

export function MenuBar({
  onOpen,
  onSong,
  onLinkFolder,
  onSaveBms,
  onSaveInfo,
}: {
  onOpen: () => void;
  onSong: () => void;
  onLinkFolder: () => void;
  onSaveBms: () => void;
  onSaveInfo: () => void;
}) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, left: 0, moved: false, id: "" });
  const showIcons = useChart((state) => state.showIcons);
  const snapOn = useChart((state) => state.snapOn);
  const heartOn = useChart((state) => {
    const ids = state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : [];
    return ids.length > 0 && ids.every((id) => state.notes.find((note) => note.id === id)?.blood);
  });
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

  function startNew() {
    player.clearMusic();
    state().setSongName("");
    void clearLoadedMusic();
    state().reset();
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
        {item("New", startNew)}
        {item("Open chart…", onOpen)}
        {item("Open song…", onSong)}
        {item("Save BMS", onSaveBms)}
        {item("Save info.json", onSaveInfo)}
        {item("Link chart folder…", onLinkFolder)}
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
        {item("Zoom in", () => zoom(1))}
        {item("Zoom out", () => zoom(-1))}
      </>)}
      {menu("options", "Options", <>
        {item("Follow play line", () => state().setFollowPlay(!followPlay), followPlay)}
        {item("Keep play line tight", () => state().setFollowTight(!followTight), followTight)}
        {item("Snap to grid", () => state().setSnapOn(!snapOn), snapOn)}
        {item("Disable vertical moves", () => state().setLockLane(!lockLane), lockLane)}
      </>)}
      {menu("convert", "Conversion", <>
        {item("Swap air and ground", () => state().swapGroundAir())}
        {item("Hidden note", () => state().toggleBlood(), heartOn)}
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
  onLinkFolder,
  onSaveBms,
  onSaveInfo,
}: {
  onOpen: () => void;
  onSong: () => void;
  onLinkFolder: () => void;
  onSaveBms: () => void;
  onSaveInfo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof localStorage === "undefined" || localStorage.getItem("stagepen-dark") !== "0");
  const showIcons = useChart((state) => state.showIcons);
  const snapOn = useChart((state) => state.snapOn);
  const heartOn = useChart((state) => {
    const ids = state.selection.length ? state.selection : state.selectedId ? [state.selectedId] : [];
    return ids.length > 0 && ids.every((id) => state.notes.find((note) => note.id === id)?.blood);
  });
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

  function startNew() {
    player.clearMusic();
    state().setSongName("");
    void clearLoadedMusic();
    state().reset();
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
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">File</p>
            {row("New", startNew)}
            {row("Open chart…", onOpen)}
            {row("Open song…", onSong)}
            {row("Save BMS", onSaveBms)}
            {row("Save info.json", onSaveInfo)}
            {row("Link chart folder…", onLinkFolder)}
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
            {row("Zoom in", () => state().setXWidth(state().xWidth + 0.5))}
            {row("Zoom out", () => state().setXWidth(state().xWidth - 0.5))}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Options</p>
            {row("Follow play line", () => state().setFollowPlay(!followPlay), followPlay)}
            {row("Keep play line tight", () => state().setFollowTight(!followTight), followTight)}
            {row("Snap to grid", () => state().setSnapOn(!snapOn), snapOn)}
            {row("Disable vertical moves", () => state().setLockLane(!lockLane), lockLane)}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">Conversion</p>
            {row("Swap air and ground", () => state().swapGroundAir())}
            {row("Hidden note", () => state().toggleBlood(), heartOn)}
            <p className="px-4 pt-3 text-xs tracking-wide text-mute uppercase">About</p>
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
