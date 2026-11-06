import { useEffect, useRef, useState, type RefObject } from "react";
import { MousePointer2, Pencil } from "lucide-react";
import { stopPoints } from "@/lib/md/bms";
import { player } from "@/lib/md/player";
import { useChart } from "@/lib/md/store";
import { formatClock, hoverTime, livePx, locate, measureStart, measureTicks, secondsAt, tempoPoints, tickToX, xToTick } from "@/lib/md/timing";

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function PlayStartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#2f80ed" />
      <path d="M9.6 7.8v8.4l7-4.2z" fill="#fff" />
    </svg>
  );
}

function PlayMeasureIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#27ae60" />
      <path d="M8 7.6v8.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.6 8.2v7.6l5.8-3.8z" fill="#fff" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="#e74c3c" />
    </svg>
  );
}

function chartEndTick(notes: { tick: number; endTick?: number }[], sigs: Parameters<typeof locate>[1]): number {
  let last = 0;
  for (const note of notes) last = Math.max(last, note.endTick ?? note.tick);
  return measureStart(locate(last, sigs, 0).measure + 4, sigs);
}

function sheetOf(scroller: HTMLElement | null, playhead: HTMLElement | null) {
  return playhead?.parentElement ?? scroller?.querySelector<HTMLElement>("[data-roll-sheet]") ?? null;
}

function panFollow(scroller: HTMLElement, sheet: HTMLElement | null, target: number) {
  livePx.follow = true;
  livePx.camera = target;
  const view = scroller.clientWidth || 1;
  const step = Math.max(256, view >> 1);
  const whole = Math.floor(target / step) * step;
  if (scroller.scrollLeft !== whole) scroller.scrollLeft = whole;
  if (sheet) {
    sheet.style.willChange = "transform";
    sheet.style.transform = `translate3d(${-(target - whole)}px,0,0)`;
  }
  livePx.redraw?.();
  livePx.wave?.();
}

function clearPan(scroller: HTMLElement | null, playhead: HTMLElement | null) {
  const sheet = sheetOf(scroller, playhead);
  const camera = livePx.camera;
  livePx.follow = false;
  if (sheet) {
    sheet.style.transform = "";
    sheet.style.willChange = "";
  }
  if (scroller) {
    scroller.scrollLeft = camera;
    livePx.camera = scroller.scrollLeft;
  }
  livePx.redraw?.();
  livePx.wave?.();
}

const toolButton = "flex h-8 shrink-0 items-center gap-1.5 rounded border px-2 text-sm text-dock-ink";

export function Transport({
  playheadRef,
  scrollerRef,
  compact = false,
  live = true,
}: {
  playheadRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  live?: boolean;
}) {
  const [, setBar] = useState(0);
  const clockRef = useRef<HTMLSpanElement>(null);
  const divide = useChart((state) => state.divide);
  const setDivide = useChart((state) => state.setDivide);
  const setPx = useChart((state) => state.setPx);
  const px = useChart((state) => state.px);
  const bgmSpeed = useChart((state) => state.bgmSpeed);
  const chartBpm = useChart((state) => state.meta.bpm);
  const tool = useChart((state) => state.tool);

  useEffect(() => {
    if (!live) return;
    let frame = 0;
    let lastPaint = 0;
    let alive = true;
    let points = tempoPoints([], 120);
    let stops = stopPoints([], [], []);
    let pointsNotes: unknown = null;
    let pointsBpm = 0;
    let stopsHeader: unknown = null;
    let stopsExtras: unknown = null;
    let stopsSigs: unknown = null;
    let clockTimer = 0;
    const paintClock = () => {
      const node = clockRef.current;
      if (!node) return;
      if (!player.playing) {
        window.clearInterval(clockTimer);
        clockTimer = 0;
        return;
      }
      node.textContent = formatClock(secondsAt(player.tickFor(points, stops), points, stops));
    };
    const loop = (now: number) => {
      if (!alive) {
        frame = 0;
        return;
      }
      if (!player.playing) {
        frame = 0;
        clearPan(scrollerRef.current, playheadRef.current);
        return;
      }
      frame = requestAnimationFrame(loop);
      const state = useChart.getState();
      if (pointsNotes !== state.notes || pointsBpm !== state.meta.bpm) {
        const bpmChanged = pointsBpm !== 0 && pointsBpm !== state.meta.bpm;
        pointsNotes = state.notes;
        pointsBpm = state.meta.bpm;
        points = tempoPoints(state.notes, state.meta.bpm);
        if (bpmChanged) player.reschedule();
      }
      if (stopsHeader !== state.headerExtras || stopsExtras !== state.extras || stopsSigs !== state.sigs) {
        stopsHeader = state.headerExtras;
        stopsExtras = state.extras;
        stopsSigs = state.sigs;
        stops = stopPoints(state.headerExtras, state.extras, state.sigs);
      }
      const tick = player.tickFor(points, stops);
      const view = scrollerRef.current?.clientWidth || 1;
      const amount = state.followAmount;
      const tight = state.followTight;
      const anchor = view * (tight ? 0.12 + (1 - amount) * 0.38 : 0.22 + (1 - amount) * 0.28);
      const target = tickToX(tick, state.px) - anchor;
      const scroller = scrollerRef.current;
      const sheet = sheetOf(scroller, playheadRef.current);
      if (scroller && state.followPlay) panFollow(scroller, sheet, Math.max(0, target));
      if (now - lastPaint > 180) {
        lastPaint = now;
        setBar(locate(tick, state.sigs, state.measureCount).measure);
        if (!clockTimer) {
          paintClock();
          clockTimer = window.setInterval(paintClock, 100);
        }
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      window.clearInterval(clockTimer);
    };
  }, [live, playheadRef, scrollerRef]);

  async function playFrom(tick: number) {
    const state = useChart.getState();
    const start = Math.max(0, tick);
    await player.ensure();
    player.seek(start);
    const end = chartEndTick(state.notes, state.sigs);
    await player.play(start, end);
  }

  async function playStart() {
    await playFrom(0);
  }

  async function playMeasure() {
    const state = useChart.getState();
    const scroller = scrollerRef.current;
    if (!scroller) {
      await playFrom(0);
      return;
    }
    const x = scroller.scrollLeft + (scroller.clientWidth || 1) * 0.2;
    let tick = xToTick(x, state.px);
    let measure = 0;
    let acc = 0;
    for (let index = 0; index < state.measureCount; index++) {
      const len = measureTicks(index, state.sigs);
      if (acc + len > tick) {
        measure = index;
        break;
      }
      acc += len;
      measure = index;
    }
    const start = measureStart(measure, state.sigs);
    await playFrom(start);
  }

  function stop() {
    player.stop();
    clearPan(scrollerRef.current, playheadRef.current);
    if (clockRef.current) clockRef.current.textContent = formatClock(0);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (player.playing) stop();
        else void playStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => void playStart()} className={toolButton + " border-dock-line bg-field"} aria-label="Play from start">
          <PlayStartIcon />
          {compact ? null : "Play"}
        </button>
        {compact ? null : (
          <button type="button" onClick={() => void playMeasure()} className={toolButton + " border-dock-line bg-field"} aria-label="Play from the measure on screen">
            <PlayMeasureIcon />
          </button>
        )}
        <button type="button" onClick={stop} className={toolButton + " border-dock-line bg-field"} aria-label="Stop">
          <StopIcon />
          {compact ? null : "Stop"}
        </button>
      </div>
      {compact ? null : <span className="mx-0.5 h-5 w-px bg-dock-line" aria-hidden />}
      <div className="flex h-8 items-center gap-1 rounded border border-dock-line bg-field px-1 text-sm text-dock-ink" title={`Playback speed. 1.00x matches this chart at ${chartBpm} BPM.`}>
        <button type="button" className="h-7 rounded px-1.5 text-xs" onClick={() => useChart.getState().setBgmSpeed(Math.max(0.25, Math.round((bgmSpeed - 0.05) * 100) / 100))}>
          −
        </button>
        <span className="min-w-[3.25rem] text-center font-mono tabular-nums">{bgmSpeed.toFixed(2)}x</span>
        <button type="button" className="h-7 rounded px-1.5 text-xs" onClick={() => useChart.getState().setBgmSpeed(Math.min(2, Math.round((bgmSpeed + 0.05) * 100) / 100))}>
          +
        </button>
      </div>
      <span ref={clockRef} className="min-w-16 text-center font-mono text-sm text-dock-ink tabular-nums">
        {formatClock(0)}
      </span>
      {compact ? null : <span className="mx-0.5 h-5 w-px bg-dock-line" aria-hidden />}
      {compact ? null : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => useChart.getState().setTool("select")}
            className={toolButton + (tool === "select" ? " border-pink bg-pink/20" : " border-dock-line bg-field")}
            aria-label="Select"
          >
            <MousePointer2 className="size-4 shrink-0" />
            Select
          </button>
          <button
            type="button"
            onClick={() => useChart.getState().setTool("write")}
            className={toolButton + (tool === "write" ? " border-pink bg-pink/20" : " border-dock-line bg-field")}
            aria-label="Edit"
          >
            <Pencil className="size-4 shrink-0 text-amber-400" />
            Edit
          </button>
          <button type="button" className={toolButton + " border-dock-line bg-field"} onClick={() => useChart.getState().undo()}>
            Undo
          </button>
          <button type="button" className={toolButton + " border-dock-line bg-field"} onClick={() => useChart.getState().redo()}>
            Redo
          </button>
        </div>
      )}
      {compact ? null : <span className="mx-0.5 h-5 w-px bg-dock-line" aria-hidden />}
      {compact ? null : (
        <>
          <label className="flex h-8 items-center gap-2 rounded border border-dock-line bg-field px-2 text-sm text-dock-ink">
            Grid
            <select value={divide} onChange={(event) => setDivide(Number(event.target.value))} className="bg-transparent font-mono text-dock-ink">
              {[8, 16, 32, 64, 192].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {[8, 16, 32, 64, 192].includes(divide) ? null : <option value={divide}>{divide}</option>}
            </select>
          </label>
          <div className="flex h-8 items-center overflow-hidden rounded border border-dock-line bg-field">
            <button type="button" className="h-8 px-2 text-sm text-dock-ink" onClick={() => setPx(px - 24)} aria-label="Zoom out">
              −
            </button>
            <button type="button" className="h-8 border-l border-dock-line px-2 text-sm text-dock-ink" onClick={() => setPx(px + 24)} aria-label="Zoom in">
              +
            </button>
          </div>
          <span
            ref={(node) => {
              hoverTime.node = node;
              if (node) node.textContent = hoverTime.text;
            }}
            className="min-w-24 text-center font-mono text-sm text-dock-ink tabular-nums"
          />
        </>
      )}
    </div>
  );
}
