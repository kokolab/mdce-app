import { TICKS, type LaneId } from "./catalog";

export type Sig = { measure: number; ratio: number };

export type TempoPoint = { tick: number; bpm: number };

export function measureTicks(measure: number, sigs: Sig[]): number {
  let ratio = 1;
  for (const sig of sigs) {
    if (sig.measure <= measure) ratio = sig.ratio;
  }
  return Math.max(1, Math.round(TICKS * ratio));
}

export function measureStart(measure: number, sigs: Sig[]): number {
  let tick = 0;
  for (let m = 0; m < measure; m++) tick += measureTicks(m, sigs);
  return tick;
}

export function totalTicks(measureCount: number, sigs: Sig[]): number {
  return measureStart(measureCount, sigs);
}

export function locate(tick: number, sigs: Sig[], _measureCount = 0) {
  let measure = 0;
  let start = 0;
  const target = Math.max(0, tick);
  while (measure < 20000) {
    const len = measureTicks(measure, sigs);
    if (target < start + len) return { measure, local: target - start, start, len };
    start += len;
    measure += 1;
  }
  const len = measureTicks(measure, sigs);
  return { measure, local: Math.max(0, target - start), start, len };
}

export function snapTick(tick: number, snap: number, sigs: Sig[], measureCount: number): number {
  const safeSnap = Math.max(1, snap);
  const spot = locate(Math.max(0, tick), sigs, measureCount);
  const step = spot.len / safeSnap;
  const snapped = Math.round(spot.local / step) * step;
  if (snapped >= spot.len - 0.001) return spot.start + spot.len;
  return spot.start + Math.max(0, snapped);
}

export function tickToX(tick: number, pxPerMeasure: number): number {
  return (tick * pxPerMeasure) / TICKS;
}

/** Pixels per measure. iBMSC draws one 4/4 bar as 192 × the width slider. */
export const livePx = { current: 912, camera: 0, follow: false, redraw: null as (() => void) | null };

export function pxForWidth(xWidth: number): number {
  return Math.round(xWidth * TICKS);
}

export function xToTick(x: number, pxPerMeasure: number): number {
  return (x / pxPerMeasure) * TICKS;
}

export function tempoPoints(
  notes: { lane: LaneId; tick: number; bpm?: number }[],
  baseBpm: number,
): TempoPoint[] {
  const points: TempoPoint[] = [{ tick: 0, bpm: Math.max(1, baseBpm) }];
  const changes = notes
    .filter((note) => note.lane === "bpm" && note.bpm && note.bpm > 0)
    .sort((a, b) => a.tick - b.tick);
  for (const change of changes) {
    const bpm = change.bpm ?? baseBpm;
    if (change.tick <= 0) points[0] = { tick: 0, bpm };
    else points.push({ tick: change.tick, bpm });
  }
  return points;
}

export type StopPoint = { tick: number; units: number };

export function secondsAt(tick: number, points: TempoPoint[], stops: StopPoint[] = []): number {
  const target = Math.max(0, tick);
  if (!stops.length) {
    let seconds = 0;
    let cursor = 0;
    for (let i = 0; i < points.length; i++) {
      const next = i + 1 < points.length ? points[i + 1].tick : target;
      const end = Math.min(target, next);
      if (end > cursor) {
        seconds += ((end - cursor) / 48) * (60 / points[i].bpm);
        cursor = end;
      }
      if (cursor >= target) break;
    }
    return seconds;
  }
  let seconds = 0;
  let cursor = 0;
  let index = 0;
  for (let i = 0; i < points.length; i++) {
    const bpm = Math.max(1, points[i].bpm);
    const limit = i + 1 < points.length ? points[i + 1].tick : target;
    const end = Math.min(target, limit);
    while (cursor < end) {
      const stop = index < stops.length ? stops[index] : undefined;
      if (stop && stop.tick < cursor) {
        index += 1;
        continue;
      }
      if (stop && stop.tick === cursor && cursor < target) {
        seconds += (stop.units / 48) * (60 / bpm);
        index += 1;
        continue;
      }
      const until = stop && stop.tick < end ? stop.tick : end;
      if (until > cursor) {
        seconds += ((until - cursor) / 48) * (60 / bpm);
        cursor = until;
      } else break;
    }
    if (cursor >= target) break;
  }
  return seconds;
}

export function tickAt(seconds: number, points: TempoPoint[], stops: StopPoint[] = []): number {
  let left = Math.max(0, seconds);
  if (!stops.length) {
    for (let i = 0; i < points.length; i++) {
      const nextTick = i + 1 < points.length ? points[i + 1].tick : Number.POSITIVE_INFINITY;
      const span = nextTick - points[i].tick;
      const spanSec = Number.isFinite(span) ? (span / 48) * (60 / points[i].bpm) : Number.POSITIVE_INFINITY;
      if (left <= spanSec || !Number.isFinite(nextTick)) {
        return points[i].tick + (left * points[i].bpm * 48) / 60;
      }
      left -= spanSec;
    }
    return 0;
  }
  let cursor = 0;
  let index = 0;
  for (let i = 0; i < points.length; i++) {
    const bpm = Math.max(1, points[i].bpm);
    const limit = i + 1 < points.length ? points[i + 1].tick : Number.POSITIVE_INFINITY;
    const scale = (bpm * 48) / 60;
    while (cursor < limit && left > 1e-8) {
      const stop = index < stops.length ? stops[index] : undefined;
      if (stop && stop.tick < cursor) {
        index += 1;
        continue;
      }
      if (stop && stop.tick === cursor && stop.tick < limit) {
        const hold = (stop.units / 48) * (60 / bpm);
        if (left <= hold) return cursor;
        left -= hold;
        index += 1;
        continue;
      }
      const until = stop && stop.tick < limit ? stop.tick : limit;
      const span = until - cursor;
      if (!Number.isFinite(span)) return cursor + left * scale;
      const spanSec = span / scale;
      if (left <= spanSec) return cursor + left * scale;
      left -= spanSec;
      cursor = until;
    }
  }
  return cursor;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frac = Math.floor((safe % 1) * 10);
  return `${mins}:${String(secs).padStart(2, "0")}.${frac}`;
}
