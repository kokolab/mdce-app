import { useEffect, useRef, useState, type RefObject } from "react";
import { MousePointer2, Pencil } from "lucide-react";
import { stopPoints } from "@/lib/md/bms";
import { player } from "@/lib/md/player";
import { useChart } from "@/lib/md/store";
import { formatClock, livePx, locate, measureStart, measureTicks, secondsAt, tempoPoints, tickToX, xToTick } from "@/lib/md/timing";

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

const toolButton = "flex h-8 shrink-0 items-center gap-1.5 rounded border px-2 text-sm text-dock-ink";

export function Transport({
  playheadRef,
  scrollerRef,
}: {
  playheadRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
}) {
  const [clock, setClock] = useState("0:00.0");
  const [bar, setBar] = useState(0);
  const divide = useChart((state) => state.divide);
  const setDivide = useChart((state) => state.setDivide);
  const setPx = useChart((state) => state.setPx);
  const px = useChart((state) => state.px);
  const sigs = useChart((state) => state.sigs);
  const setSig = useChart((state) => state.setSig);
  const measureCount = useChart((state) => state.measureCount);
  const tool = useChart((state) => state.tool);

  useEffect(() => {
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
    const loop = (now: number) => {
      if (!alive || !player.playing) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(loop);
      const state = useChart.getState();
      if (pointsNotes !== state.notes || pointsBpm !== state.meta.bpm) {
        pointsNotes = state.notes;
        pointsBpm = state.meta.bpm;
        points = tempoPoints(state.notes, state.meta.bpm);
      }
      if (stopsHeader !== state.headerExtras || stopsExtras !== state.extras || stopsSigs !== state.sigs) {
        stopsHeader = state.headerExtras;
        stopsExtras = state.extras;
        stopsSigs = state.sigs;
        stops = stopPoints(state.headerExtras ?? [], state.extras ?? [], state.sigs);
      }
      player.pump(state.notes, points, stops);
      const tick = Math.max(0, player.tickFor(points, stops));
      const node = playheadRef.current;
      if (node) node.style.setProperty("--play", String(tick));
      const scroller = scrollerRef.current;
      if (scroller && state.followPlay) {
        const x = tickToX(tick, livePx.current);
        const view = scroller.clientWidth;
        const tight = state.followTight;
        const amount = state.followAmount;
        const anchor = view * (tight ? 0.15 + (1 - amount) * 0.5 : 0.25);
        if (tight || x > scroller.scrollLeft + view * 0.75 || x < scroller.scrollLeft + 16) {
          scroller.scrollLeft = Math.max(0, x - anchor);
        }
      }
      if (now - lastPaint > 180) {
        lastPaint = now;
        setClock(formatClock(secondsAt(tick, points, stops)));
        setBar(locate(tick, state.sigs, state.measureCount).measure);
      }
    };
    const start = () => {
      if (!frame && player.playing) frame = requestAnimationFrame(loop);
    };
    document.addEventListener("stagepen-playback", start);
    return () => {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("stagepen-playback", start);
    };
  }, [playheadRef, scrollerRef]);

  async function playFrom(seconds: number) {
    const state = useChart.getState();
    await player.ensure();
    await player.loadUsed(state.notes);
    player.play(Math.max(0, seconds));
    document.dispatchEvent(new Event("stagepen-playback"));
  }

  async function playStart() {
    await playFrom(0);
  }

  async function playMeasure() {
    const state = useChart.getState();
    const scroller = scrollerRef.current;
    const left = xToTick(scroller?.scrollLeft ?? 0, livePx.current);
    const right = xToTick((scroller?.scrollLeft ?? 0) + (scroller?.clientWidth ?? 0), livePx.current);
    let tick = 0;
    let measure = 0;
    let best = 0;
    for (let index = 0; index < state.measureCount; index++) {
      const len = measureTicks(index, state.sigs);
      const overlap = Math.min(right, tick + len) - Math.max(left, tick);
      if (overlap > best) {
        best = overlap;
        measure = index;
      }
      tick += len;
    }
    const start = measureStart(measure, state.sigs);
    const points = tempoPoints(state.notes, state.meta.bpm);
    const stops = stopPoints(state.headerExtras ?? [], state.extras ?? [], state.sigs);
    await playFrom(secondsAt(start, points, stops));
  }

  function stop() {
    player.stop();
    setClock("0:00.0");
    setBar(0);
    playheadRef.current?.style.setProperty("--play", "0");
  }

  const playStartRef = useRef(playStart);
  playStartRef.current = playStart;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || typingTarget(event.target)) return;
      event.preventDefault();
      if (player.playing) stop();
      else void playStartRef.current();
    };
    window.addEventListener("keydown", onKey);
    const onToggle = () => {
      if (player.playing) stop();
      else void playStartRef.current();
    };
    const onStop = () => stop();
    document.addEventListener("stagepen-toggle-play", onToggle);
    document.addEventListener("stagepen-stop", onStop);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("stagepen-toggle-play", onToggle);
      document.removeEventListener("stagepen-stop", onStop);
    };
  }, []);

  const ratio = sigs.reduce((current, sig) => (sig.measure <= bar ? sig.ratio : current), 1);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => void playStart()} className={toolButton + " border-dock-line bg-field"} aria-label="Play from the beginning">
        <PlayStartIcon />
        Play
      </button>
      <button type="button" onClick={() => void playMeasure()} className={toolButton + " border-dock-line bg-field"} aria-label="Play from the measure on screen">
        <PlayMeasureIcon />
        Measure
      </button>
      <button type="button" onClick={stop} className={toolButton + " border-dock-line bg-field"} aria-label="Stop">
        <StopIcon />
        Stop
      </button>
      <span className="px-0.5 text-dock-line" aria-hidden>
        |
      </span>
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
      <span className="min-w-16 font-mono text-sm text-dock-ink">{clock}</span>
      <label className="flex h-8 items-center gap-2 rounded border border-dock-line bg-field px-2 text-sm text-dock-ink">
        Grid
        <select value={divide} onChange={(event) => setDivide(Number(event.target.value))} className="bg-transparent font-mono text-dock-ink">
          {[1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 192].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          {[1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 192].includes(divide) ? null : <option value={divide}>{divide}</option>}
        </select>
      </label>
      <label className="flex h-8 items-center gap-2 rounded border border-dock-line bg-field px-2 text-sm text-dock-ink">
        Bar {String(bar).padStart(3, "0")}
        <select
          value={ratio}
          onChange={(event) => setSig(bar, Number(event.target.value))}
          className="bg-transparent font-mono text-paper"
        >
          <option value={1}>4/4</option>
          <option value={0.75}>3/4</option>
          <option value={0.5}>2/4</option>
          <option value={1.25}>5/4</option>
          <option value={1.5}>6/4</option>
          <option value={0.875}>7/8</option>
        </select>
      </label>
      <div className="flex h-8 items-center rounded border border-dock-line bg-field">
        <button type="button" className="h-8 px-2 text-sm text-dock-ink" onClick={() => setPx(px - 24)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="h-8 border-l border-dock-line px-2 text-sm text-dock-ink" onClick={() => setPx(px + 24)} aria-label="Zoom in">
          +
        </button>
      </div>
    </div>
  );
}
