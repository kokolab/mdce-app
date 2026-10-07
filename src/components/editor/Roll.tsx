import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { DISPLAY_LANES, HOLD_KEYS, LANE_BY_ID, LANE_UNITS, noteLabel, noteName, noteTravel, type LaneId } from "@/lib/md/catalog";
import type { ChartNote } from "@/lib/md/bms";
import { player } from "@/lib/md/player";
import { NoteIcon, HoldNote, MasherNote, GearIcon, GeminiIcon, ApproachArrow, BossBadge, bossMark } from "./NoteIcon";
import { useChart } from "@/lib/md/store";
import { livePx, measureTicks, pxForWidth, secondsAt, snapTick, tempoPoints, tickToX, totalTicks, xToTick, type Sig } from "@/lib/md/timing";
import { stopPoints } from "@/lib/md/bms";

type Ghost = { lane: LaneId; tick: number; end?: number };

const GEMINI_LOWER: Partial<Record<LaneId, LaneId>> = { air: "gnd", air2: "gnd2" };

function geminiLinks(
  notes: ChartNote[],
  laneHeightOf: (id: LaneId) => number,
  noteSize: number,
  viewLeft: number,
  viewRight: number,
  px: number,
) {
  const tickOf = (note: ChartNote) => note.tick;
  const mates = new Map<string, ChartNote>();
  const gemini: ChartNote[] = [];
  for (const note of notes) {
    if (note.key !== "0E") continue;
    gemini.push(note);
    mates.set(`${note.lane}:${tickOf(note)}`, note);
  }
  const laneTop: Partial<Record<LaneId, number>> = {};
  let top = 32;
  for (const id of DISPLAY_LANES) {
    laneTop[id] = top;
    top += laneHeightOf(id);
  }
  const links: { key: string; left: string; top: number; height: number }[] = [];
  for (const note of gemini) {
    const lowerLane = GEMINI_LOWER[note.lane];
    if (!lowerLane) continue;
    const tick = tickOf(note);
    const x = tickToX(tick, px);
    if (x < viewLeft || x > viewRight) continue;
    const mate = mates.get(`${lowerLane}:${tick}`);
    if (!mate) continue;
    const upperH = laneHeightOf(note.lane);
    const lowerH = laneHeightOf(lowerLane);
    const upperSize = Math.min(noteSize, Math.max(14, upperH - 6));
    const lowerSize = Math.min(noteSize, Math.max(14, lowerH - 6));
    const y1 = (laneTop[note.lane] ?? 0) + (upperH + upperSize) / 2 - 8;
    const y2 = (laneTop[lowerLane] ?? 0) + (lowerH - lowerSize) / 2 + 8;
    links.push({
      key: note.id + mate.id,
      left: `calc(${tick} * var(--px) / 192 * 1px)`,
      top: y1,
      height: Math.max(2, y2 - y1),
    });
  }
  return links.map((link) => (
    <div
      key={link.key}
      className="pointer-events-none absolute z-20 w-3.5 -translate-x-1/2"
      style={{
        left: link.left,
        top: link.top,
        height: link.height,
        background: "linear-gradient(to bottom, var(--color-airnote), var(--color-gndnote))",
      }}
    />
  ));
}

function chipClass(lane: LaneId): string {
  switch (lane) {
    case "air":
    case "air2":
      return "bg-airnote text-black";
    case "gnd":
    case "gnd2":
      return "bg-gndnote text-black";
    case "boss":
      return "bg-gold text-ink";
    case "boss2":
      return "border border-gold bg-ink text-gold";
    default:
      return "bg-paper text-ink";
  }
}

function wash(lane: LaneId): string {
  if (lane === "air" || lane === "air2") return "bg-lane-air/80";
  if (lane === "gnd" || lane === "gnd2") return "bg-lane-gnd/80";
  if (lane === "boss" || lane === "boss2") return "bg-lane-boss/90";
  return "bg-chart/80";
}

function GridCanvas({
  scrollerRef,
  sigs,
  measureCount,
  px,
  divide,
  sub,
  top,
  height,
  redrawRef,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  sigs: Sig[];
  measureCount: number;
  px: number;
  divide: number;
  sub: number;
  top: number;
  height: number;
  redrawRef: RefObject<(() => void) | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const canvas = canvasRef.current;
    if (!scroller || !canvas) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const dpr = window.devicePixelRatio || 1;
      const width = scroller.clientWidth;
      const cssHeight = height;
      const nextW = Math.max(1, Math.floor(width * dpr));
      const nextH = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.width = nextW;
        canvas.height = nextH;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const camera = livePx.follow ? livePx.camera : scroller.scrollLeft;
      canvas.style.transform = `translate3d(${camera}px,0,0)`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, cssHeight);
      const viewLeft = camera;
      const viewRight = viewLeft + width;
      const divN = Math.max(1, divide);
      const subN = Math.max(1, sub);
      let cursor = 0;
      for (let measure = 0; measure < measureCount; measure++) {
        const start = cursor;
        const len = measureTicks(measure, sigs);
        cursor += len;
        const x0 = tickToX(start, livePx.current);
        const x1 = tickToX(start + len, livePx.current);
        if (x1 < viewLeft - 2 || x0 > viewRight + 2) continue;
        const unit = (x1 - x0) / len;
        const paint = (step: number, color: string, weight: number) => {
          const gap = step * unit;
          if (gap < 1.5) return;
          for (let tick = step; tick < len - 0.01; tick += step) {
            const x = x0 + tick * unit - viewLeft;
            if (x < -1 || x > width + 1) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x, 0, weight, cssHeight);
          }
        };
        // iBMSC: divide lines every 192/gDivide, sub lines every 192/gSub. Not divide×sub.
        paint(192 / divN, "rgba(255,255,255,0.16)", 1);
        paint(192 / subN, "rgba(255,255,255,0.45)", 1);
        const bar = (tick: number, weight: number) => {
          const x = tickToX(start + tick, livePx.current) - viewLeft;
          if (x < -2 || x > width + 2) return;
          ctx.fillStyle = "rgba(255,255,255,0.82)";
          ctx.fillRect(x, 0, weight, cssHeight);
        };
        bar(0, 2);
        if (measure === measureCount - 1) bar(len, 2);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    schedule();
    redrawRef.current = draw;
    livePx.redraw = draw;
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (redrawRef.current === draw) redrawRef.current = null;
      if (livePx.redraw === draw) livePx.redraw = null;
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [scrollerRef, sigs, measureCount, px, divide, sub, height, redrawRef]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute left-0 z-[1]" style={{ top, height }} />;
}

type DragOrigin = { id: string; tick: number; endTick?: number; music: boolean; boxW: number };
type DragState = {
  id: string;
  mode: "move" | "resize";
  x: number;
  tick: number;
  end?: number;
  origins: DragOrigin[];
};

function layoutNote(el: HTMLElement, tick: number, endTick: number | undefined, music: boolean, boxW: number) {
  const held = endTick != null && endTick > tick;
  el.style.left = music
    ? `calc(${tick} * var(--px) / 192 * 1px)`
    : `calc(${tick} * var(--px) / 192 * 1px - ${boxW / 2}px)`;
  if (held) el.style.width = `calc(${(endTick ?? tick) - tick} * var(--px) / 192 * 1px + ${boxW}px)`;
}

function noteEl(sheet: HTMLDivElement | null, id: string) {
  return sheet?.querySelector<HTMLElement>(`[data-note="${CSS.escape(id)}"]`) ?? null;
}

const NoteChip = memo(function NoteChip({
  note,
  laneH,
  noteSize,
  showIcons,
  selected,
  drag,
  sheetRef,
}: {
  note: ChartNote;
  laneH: number;
  noteSize: number;
  showIcons: boolean;
  selected: boolean;
  drag: { current: DragState | null };
  sheetRef: RefObject<HTMLDivElement | null>;
}) {
  const label = note.lane === "bpm" ? String(Math.round(note.bpm ?? 0)) : noteLabel(note.key);
  const icons = showIcons && note.lane !== "bpm";
  const size = Math.min(noteSize, Math.max(14, laneH - 6));
  const masher = note.key === "0G" || note.key === "16" || note.key === "17";
  const music = note.key === "10";
  const gear = note.key === "0H" || note.key === "18";
  const gearHalf = gear && (note.lane === "gnd" || note.lane === "gnd2");
  const held = note.endTick != null && note.endTick > note.tick;
  const boxW = music ? Math.max(18, Math.round(size * 0.7)) : size;
  const boxH = music ? Math.max(size, laneH - 4) : size;
  const span = held ? `calc(${(note.endTick ?? note.tick) - note.tick} * var(--px) / 192 * 1px + ${size}px)` : `${boxW}px`;
  const left = music
    ? `calc(${note.tick} * var(--px) / 192 * 1px)`
    : `calc(${note.tick} * var(--px) / 192 * 1px - ${boxW / 2}px)`;
  const round = icons && !held && !music;
  const travel = round ? noteTravel(note.key) : null;
  const badge = icons && !held ? bossMark(note.key) : null;
  return (
    <button
      type="button"
      data-note={note.id}
      title={note.lane === "bpm" ? `${label} BPM` : noteName(note.key)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const mode = held && event.clientX > rect.right - 16 ? "resize" : "move";
        const state = useChart.getState();
        if (event.shiftKey) {
          state.select(note.id, true);
          return;
        }
        const inGroup = state.selection.includes(note.id);
        if (!inGroup) state.select(note.id);
        const ids = inGroup ? state.selection : [note.id];
        const xHeight = state.xHeight;
        const noteSizeNow = Math.max(16, Math.round(30 * xHeight));
        const origins = state.notes
          .filter((item) => ids.includes(item.id))
          .map((item) => {
            const itemLane = Math.max(22, Math.round(LANE_UNITS[item.lane] * xHeight));
            const itemSize = Math.min(noteSizeNow, Math.max(14, itemLane - 6));
            const itemMusic = item.key === "10";
            return {
              id: item.id,
              tick: item.tick,
              endTick: item.endTick,
              music: itemMusic,
              boxW: itemMusic ? Math.max(18, Math.round(itemSize * 0.7)) : itemSize,
            };
          });
        drag.current = { id: note.id, mode, x: event.clientX, tick: note.tick, end: note.endTick, origins };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.id !== note.id) return;
        const state = useChart.getState();
        const grid = state.snapOn ? state.snap : 192;
        const delta = xToTick(event.clientX - active.x, livePx.current);
        const sheet = sheetRef.current;
        if (active.mode === "resize") {
          const end = snapTick(Math.max(note.tick, (active.end ?? note.tick) + delta), grid, state.sigs, state.measureCount);
          const el = noteEl(sheet, note.id);
          if (el) layoutNote(el, note.tick, end > note.tick ? end : undefined, music, boxW);
          return;
        }
        const snapped = snapTick(Math.max(0, active.tick + delta), grid, state.sigs, state.measureCount);
        const shift = snapped - active.tick;
        for (const origin of active.origins) {
          const el = noteEl(sheet, origin.id);
          if (!el) continue;
          const tick = Math.max(0, origin.tick + shift);
          const length = origin.endTick != null ? origin.endTick - origin.tick : 0;
          layoutNote(el, tick, length > 0 ? tick + length : undefined, origin.music, origin.boxW);
        }
      }}
      onPointerUp={(event) => {
        const active = drag.current;
        if (!active || active.id !== note.id) return;
        drag.current = null;
        const delta = xToTick(event.clientX - active.x, livePx.current);
        const moved = Math.abs(event.clientX - active.x) >= 4;
        if (!moved) {
          const sheet = sheetRef.current;
          for (const origin of active.origins) {
            const el = noteEl(sheet, origin.id);
            if (el) layoutNote(el, origin.tick, origin.endTick, origin.music, origin.boxW);
          }
          return;
        }
        const state = useChart.getState();
        if (active.mode === "resize") state.resizeNote(note.id, (active.end ?? note.tick) + delta);
        else state.moveGroup(note.id, Math.max(0, active.tick + delta));
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        useChart.getState().remove(note.id);
      }}
      className={
        "absolute z-10 font-mono text-xs font-medium " +
        (held
          ? "overflow-visible "
          : "flex items-center overflow-hidden " +
            (music ? "justify-center rounded-sm " : round ? "justify-center rounded-full " : "justify-start rounded-md px-1 ") +
            chipClass(note.lane) +
            (note.key === "0G" || note.key === "16" || note.key === "17" ? " stripe" : "")) +
        (selected ? " ring-2 ring-paper" : "")
      }
      style={{ left, width: span, height: boxH, top: music ? 2 : (laneH - boxH) / 2 }}
    >
      {gear && icons ? (
        <GearIcon half={gearHalf} boss={note.key === "18"} className="h-[82%] w-[82%]" />
      ) : music ? (
        <span className="flex h-full flex-col items-center justify-center gap-px text-[10px] leading-none font-semibold">
          {"music".split("").map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </span>
      ) : held ? (
        masher ? (
          <MasherNote lane={note.lane} size={size} noteKey={note.key} />
        ) : (
          <HoldNote lane={note.lane} size={size} />
        )
      ) : icons && note.key === "0E" ? (
        <GeminiIcon up={note.lane === "gnd" || note.lane === "gnd2"} className="h-[92%] w-[92%]" />
      ) : icons ? (
        <NoteIcon noteKey={note.key} className="h-[78%] w-[78%]" />
      ) : (
        label
      )}
      {icons && note.blood ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-ink" /> : null}
      {travel ? <ApproachArrow dir={travel} lane={note.lane} /> : null}
      {badge ? <BossBadge text={badge} /> : null}
    </button>
  );
});

export function Roll({
  playheadRef,
  scrollerRef,
}: {
  playheadRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
}) {
  const notes = useChart((state) => state.notes);
  const sigs = useChart((state) => state.sigs);
  const measureCount = useChart((state) => state.measureCount);
  const px = useChart((state) => state.px);
  const snap = useChart((state) => state.snap);
  const divide = useChart((state) => state.divide);
  const sub = useChart((state) => state.sub);
  const xHeight = useChart((state) => state.xHeight);
  const selectedId = useChart((state) => state.selectedId);
  const selection = useChart((state) => state.selection);
  const showIcons = useChart((state) => state.showIcons);
  const focusTick = useChart((state) => state.focusTick);
  const place = useChart((state) => state.place);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [viewport, setViewport] = useState({ left: 0, width: 1280 });
  const drag = useRef<DragState | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const zooming = useRef(false);
  const laneHeightOf = (id: LaneId) => Math.max(22, Math.round(LANE_UNITS[id] * xHeight));
  const stackHeight = DISPLAY_LANES.reduce((sum, id) => sum + laneHeightOf(id), 0);
  const noteSize = Math.max(16, Math.round(30 * xHeight));

  useEffect(() => {
    const { xWidth, px: current } = useChart.getState();
    if (Math.abs(current - pxForWidth(xWidth)) > 1) useChart.getState().setXWidth(xWidth);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (zooming.current) return;
      const left = scroller.scrollLeft;
      const width = scroller.clientWidth || 1;
      setViewport((prev) => (prev.width === width && Math.abs(prev.left - left) < 160 ? prev : { left, width }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [scrollerRef]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const zoom = { delta: 0, x: 0, frame: 0, commit: 0 };
    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      zoom.delta += event.deltaY || event.deltaX;
      zoom.x = event.clientX;
      if (zoom.frame) return;
      zoom.frame = requestAnimationFrame(() => {
        const delta = zoom.delta;
        const x = zoom.x;
        zoom.delta = 0;
        zoom.frame = 0;
        if (!delta) return;
        const rect = scroller.getBoundingClientRect();
        const before = livePx.current;
        const tick = xToTick(x - rect.left + scroller.scrollLeft, before);
        const steps = Math.min(4, Math.max(1, Math.round(Math.abs(delta) / 80)));
        const factor = (delta > 0 ? 1 / 1.12 : 1.12) ** steps;
        const xWidth = Math.min(16, Math.max(0.5, Math.round((before / 192) * factor * 100) / 100));
        const after = Math.round(xWidth * 192);
        if (after !== before) {
          zooming.current = true;
          livePx.current = after;
          sheetRef.current?.style.setProperty("--px", String(after));
          redrawRef.current?.();
          scroller.scrollLeft = tickToX(tick, after) - (x - rect.left);
        }
        window.clearTimeout(zoom.commit);
        zoom.commit = window.setTimeout(() => {
          zooming.current = false;
          useChart.getState().setXWidth(livePx.current / 32);
          setViewport({ left: scroller.scrollLeft, width: scroller.clientWidth || 1 });
        }, 180);
      });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      window.clearTimeout(zoom.commit);
    };
  }, [scrollerRef]);

  useEffect(() => {
    if (focusTick == null) return;
    const id = useChart.getState().selectedId;
    const scroller = scrollerRef.current;
    const node = id ? sheetRef.current?.querySelector<HTMLElement>(`[data-note="${CSS.escape(id)}"]`) : null;
    if (node) node.scrollIntoView({ inline: "center", block: "center", behavior: "auto" });
    else if (scroller) scroller.scrollLeft = Math.max(0, tickToX(focusTick, livePx.current) - scroller.clientWidth * 0.35);
    useChart.setState({ focusTick: null });
  }, [focusTick, scrollerRef]);

  function tickAt(clientX: number, host: HTMLElement) {
    const rect = host.getBoundingClientRect();
    return snapTick(xToTick(clientX - rect.left, livePx.current), snap, sigs, measureCount);
  }

  const pxNow = livePx.current;
  const total = totalTicks(measureCount, sigs);
  const width = `calc(${Math.max(total, 192 * 4)} * var(--px) / 192 * 1px)`;
  const pad = Math.max(pxNow, viewport.width);
  const viewLeft = viewport.left - pad;
  const viewRight = viewport.left + viewport.width + pad;
  const selected = new Set(selection);
  const visibleNotes = notes.filter((note) => {
    if (selected.has(note.id) || note.id === selectedId) return true;
    const tick = note.tick;
    const end = note.endTick ?? tick;
    const x0 = tickToX(Math.min(tick, end), pxNow);
    const x1 = tickToX(Math.max(tick, end), pxNow);
    return x1 >= viewLeft && x0 <= viewRight;
  });
  const notesByLane = new Map<string, ChartNote[]>();
  for (const note of visibleNotes) {
    const list = notesByLane.get(note.lane);
    if (list) list.push(note);
    else notesByLane.set(note.lane, [note]);
  }
  const measureLabels: { measure: number; tick: number; len: number }[] = [];
  {
    let start = 0;
    for (let measure = 0; measure < measureCount; measure++) {
      const len = measureTicks(measure, sigs);
      const left = tickToX(start, pxNow);
      const span = Math.max(1, tickToX(len, pxNow));
      if (left + span >= viewLeft && left <= viewRight) measureLabels.push({ measure, tick: start, len });
      start += len;
    }
  }

  return (
    <div className="flex min-h-0">
      <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-white/15 bg-chart">
        <div className="h-8" />
        {DISPLAY_LANES.map((id) => {
          const lane = LANE_BY_ID[id];
          return (
            <div
              key={lane.id}
              className={"flex items-center px-1.5 text-xs font-semibold text-lane-label " + wash(lane.id)}
              style={{ height: laneHeightOf(lane.id) }}
              title={lane.hint}
            >
              {lane.label}
            </div>
          );
        })}
      </div>
      <div className="relative min-h-0 min-w-0 flex-1">
      <div ref={scrollerRef} className="roll h-full overflow-x-auto overflow-y-hidden" onContextMenu={(event) => event.preventDefault()}>
        <div
          ref={sheetRef}
          data-roll-sheet
          className="relative"
          style={{ width, ["--px" as string]: pxNow }}
        >
          <GridCanvas
            scrollerRef={scrollerRef}
            sigs={sigs}
            measureCount={measureCount}
            px={px}
            divide={divide}
            sub={sub}
            top={32}
            height={stackHeight}
            redrawRef={redrawRef}
          />
          <div className="relative z-20 flex h-8">
            {measureLabels.map(({ measure, tick: measureTick, len }) => {
              return (
                <button
                  key={measure}
                  type="button"
                  className="absolute top-0 flex h-8 items-end border-l border-white/40 px-1 pb-1 font-mono text-xs text-mute"
                  style={{
                    left: `calc(${measureTick} * var(--px) / 192 * 1px)`,
                    width: `calc(${len} * var(--px) / 192 * 1px)`,
                  }}
                  onClick={(event) => {
                    const host = event.currentTarget.parentElement ?? event.currentTarget;
                    const tick = tickAt(event.clientX, host);
                    const { notes: current, meta, extras, headerExtras, sigs: timeSigs } = useChart.getState();
                    player.seek(secondsAt(tick, tempoPoints(current, meta.bpm), stopPoints(headerExtras ?? [], extras ?? [], timeSigs)));
                  }}
                >
                  {String(measure).padStart(3, "0")}
                </button>
              );
            })}
          </div>
          {DISPLAY_LANES.map((id) => {
            const lane = LANE_BY_ID[id];
            return (
              <div
                key={lane.id}
                className={"relative border-b border-white/10 " + wash(lane.id)}
                style={{ height: laneHeightOf(lane.id) }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  if ((event.target as HTMLElement).closest("button")) return;
                  if (useChart.getState().tool === "select") {
                    useChart.getState().select(null);
                    return;
                  }
                  const host = event.currentTarget;
                  const start = tickAt(event.clientX, host);
                  const brush = useChart.getState().brush;
                  const canHold = HOLD_KEYS.has(brush) && lane.id !== "bpm" && lane.id !== "bgm";
                  host.setPointerCapture(event.pointerId);
                  const pointer = event.pointerId;
                  const origin = event.clientX;
                  const move = (ev: PointerEvent) => {
                    if (ev.pointerId !== pointer) return;
                    const end = tickAt(ev.clientX, host);
                    if (canHold) setGhost({ lane: lane.id, tick: Math.min(start, end), end: Math.max(start, end) });
                  };
                  const up = (ev: PointerEvent) => {
                    if (ev.pointerId !== pointer) return;
                    host.removeEventListener("pointermove", move);
                    host.removeEventListener("pointerup", up);
                    const end = tickAt(ev.clientX, host);
                    setGhost(null);
                    if (canHold && Math.abs(ev.clientX - origin) > 6 && end !== start) place(lane.id, start, end);
                    else place(lane.id, start);
                  };
                  host.addEventListener("pointermove", move);
                  host.addEventListener("pointerup", up);
                }}
              >
                {notesByLane.get(lane.id)?.map((note) => (
                  <NoteChip
                    key={note.id}
                    note={note}
                    laneH={laneHeightOf(lane.id)}
                    noteSize={noteSize}
                    showIcons={showIcons}
                    selected={selected.has(note.id) || note.id === selectedId}
                    drag={drag}
                    sheetRef={sheetRef}
                  />
                ))}
                {ghost?.lane === lane.id ? (
                  <div
                    className="pointer-events-none absolute overflow-visible"
                    style={{
                      left: `calc(${ghost.tick} * var(--px) / 192 * 1px - ${Math.min(noteSize, laneHeightOf(lane.id) - 6) / 2}px)`,
                      width: `calc(${(ghost.end ?? ghost.tick) - ghost.tick} * var(--px) / 192 * 1px + ${Math.min(noteSize, laneHeightOf(lane.id) - 6)}px)`,
                      height: Math.min(noteSize, laneHeightOf(lane.id) - 6),
                      top: (laneHeightOf(lane.id) - Math.min(noteSize, laneHeightOf(lane.id) - 6)) / 2,
                      opacity: 0.7,
                    }}
                  >
                    {useChart.getState().brush === "0G" || useChart.getState().brush === "16" || useChart.getState().brush === "17" ? (
                      <MasherNote lane={lane.id} size={Math.min(noteSize, laneHeightOf(lane.id) - 6)} noteKey={useChart.getState().brush} />
                    ) : (
                      <HoldNote lane={lane.id} size={Math.min(noteSize, laneHeightOf(lane.id) - 6)} />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {geminiLinks(notes, laneHeightOf, noteSize, viewLeft, viewRight, pxNow)}
          <div
            ref={playheadRef}
            className="pointer-events-none absolute top-0 bottom-0 left-0 z-30 w-0.5 bg-pink [backface-visibility:hidden]"
            style={{ transform: "translate3d(calc(var(--play, 0) * var(--px) / 192 * 1px),0,0)" }}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
