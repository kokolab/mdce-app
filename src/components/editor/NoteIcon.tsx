import type { ReactNode } from "react";
import { NOTE_BY_KEY, type LaneId } from "@/lib/md/catalog";

const FLIP = new Set(["0I", "0J"]);

function speedCount(key: string): number {
  if (key === "0Q" || key === "0T" || key === "0W") return 3;
  if (key === "0P" || key === "0S" || key === "0V") return 2;
  return 1;
}

function Chevrons({ count, rotate }: { count: number; rotate: number }) {
  const start = 12 - count * 2.4;
  return (
    <g transform={`rotate(${rotate} 12 12)`} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: count }, (_, index) => {
        const x = start + index * 4.8;
        return <path key={index} d={`M${x} 8 l3.2 4 -3.2 4`} />;
      })}
    </g>
  );
}

function dots(points: [number, number][], radius = 1.7) {
  return points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={radius} fill="currentColor" />);
}

function mark(key: string) {
  switch (key) {
    case "01":
    case "02":
    case "03":
    case "34":
      return <circle cx="12" cy="12" r="2.3" fill="currentColor" />;
    case "04":
    case "05":
    case "06":
    case "30":
      return <circle cx="12" cy="12" r="4.1" fill="currentColor" />;
    case "07":
    case "08":
    case "09":
      return <rect x="8" y="8" width="8" height="8" rx="1.2" fill="currentColor" />;
    case "0A":
    case "38":
      return <circle cx="12" cy="12" r="6.2" fill="currentColor" />;
    case "0B":
      return <circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" strokeWidth="2.6" />;
    case "0E":
      return (
        <g fill="currentColor">
          <circle cx="8.6" cy="12" r="2.5" />
          <circle cx="15.4" cy="12" r="2.5" />
        </g>
      );
    case "0F":
      return <polygon points="12,4.2 14.1,9.2 19.4,9.5 15.4,12.8 16.7,18 12,15.2 7.3,18 8.6,12.8 4.6,9.5 9.9,9.2" fill="currentColor" />;
    case "0G":
    case "16":
    case "17":
      return <GloveMark />;
    case "11":
      return <path d="M7 17 L17 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />;
    case "12":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 15.5 L15.5 6" />
          <path d="M8.5 18 L18 8.5" />
        </g>
      );
    case "13":
      return <polygon points="12,7.5 16.5,12 12,16.5 7.5,12" fill="currentColor" />;
    case "14":
      return dots(
        [
          [8.5, 12],
          [15.5, 12],
        ],
        2.1,
      );
    case "15":
      return dots(
        [
          [12, 7.4],
          [8.2, 15.2],
          [15.8, 15.2],
        ],
        2,
      );
    case "0O":
    case "0P":
    case "0Q":
      return <Chevrons count={speedCount(key)} rotate={0} />;
    case "0R":
    case "0S":
    case "0T":
      return <Chevrons count={speedCount(key)} rotate={90} />;
    case "0U":
    case "0V":
    case "0W":
      return <Chevrons count={speedCount(key)} rotate={-90} />;
    case "20":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M8 7h8l-1.2 10H9.2z" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </g>
      );
    case "21":
      return <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.1 2.2" />;
    case "22":
      return <path d="M12 17.2c-3.8-2.2-6-4.4-6-7a3.1 3.1 0 0 1 5.4-2 3.1 3.1 0 0 1 5.4 2c0 2.6-2.2 4.8-4.8 7z" fill="currentColor" />;
    case "10":
      return (
        <g fill="currentColor">
          <ellipse cx="9.2" cy="16" rx="2.5" ry="1.8" />
          <rect x="11.2" y="5" width="1.6" height="11" />
          <path d="M12.8 5.2h5.2v3.2h-5.2z" />
        </g>
      );
    case "1A":
      return <polygon points="6,8 6,16 16,12" fill="currentColor" />;
    case "1B":
      return <polygon points="18,8 18,16 8,12" fill="currentColor" />;
    case "1C":
      return <polygon points="8,17 12,7 16,17" fill="currentColor" />;
    case "1E":
      return (
        <g fill="currentColor">
          <polygon points="7,16 10.2,8 13.4,16" />
          <polygon points="10.6,16 13.8,8 17,16" />
        </g>
      );
    case "1D":
    case "2Z":
      return <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />;
    case "1F":
      return <rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />;
    case "1G":
    case "1H":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9h8l-2.2-2.2M18 15H10l2.2 2.2" />
        </g>
      );
    case "1J":
    case "1L":
    case "25":
      return <path d="M7 17 L17 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />;
    case "1K":
    case "1M":
    case "26":
      return <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />;
    case "1O":
      return (
        <g fill="currentColor">
          <circle cx="12" cy="12" r="2" />
          <circle cx="17" cy="8" r="1.3" />
        </g>
      );
    case "1P":
      return (
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 6v2.2M12 15.8V18M6 12h2.2M15.8 12H18" />
        </g>
      );
    case "1Q":
      return (
        <g fill="currentColor">
          <rect x="6" y="12" width="3" height="6" />
          <rect x="10.5" y="8" width="3" height="10" />
          <rect x="15" y="13" width="3" height="5" />
        </g>
      );
    case "1R":
      return dots(
        [
          [8, 8],
          [12, 12],
          [16, 16],
        ],
        1.3,
      );
    case "1S":
      return dots(
        [
          [12, 8.5],
          [12, 15],
        ],
        2.2,
      );
    case "1T":
      return (
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 16 L7 8M12 16 L12 7M12 16 L17 8" />
        </g>
      );
    case "1U":
      return <path d="M5 13c2-4 4-4 6 0s4 4 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
    case "1V":
      return <path d="M16.5 8.5a6 6 0 1 0 1 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
    case "1W":
      return (
        <g fill="currentColor">
          <rect x="6" y="12" width="2.4" height="5" />
          <rect x="10.8" y="8" width="2.4" height="9" />
          <rect x="15.6" y="10" width="2.4" height="7" />
        </g>
      );
    case "1X":
      return (
        <g fill="currentColor">
          <rect x="8" y="6" width="1.6" height="8" />
          <rect x="14.4" y="6" width="1.6" height="8" />
          <circle cx="8.8" cy="16" r="1.8" />
          <circle cx="15.2" cy="16" r="1.8" />
        </g>
      );
    case "2Y":
      return <polygon points="8,7 17,12 8,17" fill="currentColor" />;
    default:
      return <circle cx="12" cy="12" r="2" fill="currentColor" />;
  }
}

/** Spiked gear drawn inside the lane circle. Ground lanes show the top half. */
export function GearIcon({ half, boss, className = "" }: { half: boolean; boss: boolean; className?: string }) {
  return (
    <span className={"inline-flex flex-col items-center justify-center " + className}>
      <span className="w-[90%] overflow-hidden" style={{ height: half ? "42%" : boss ? "68%" : "84%" }}>
        <svg viewBox="0 0 64 64" className="block w-full" style={{ height: half ? "200%" : "100%" }} aria-hidden>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <polygon key={angle} points="32,1.5 25.5,16 38.5,16" fill="#f4f4f5" transform={`rotate(${angle} 32 32)`} />
          ))}
          <circle cx="32" cy="32" r="19" fill="#c084fc" />
          <circle cx="32" cy="32" r="14.5" fill="#f9a8d4" />
          <circle cx="32" cy="32" r="10" fill="#fbcfe8" />
          <rect x="30.1" y="17.5" width="3.8" height="29" rx="1.6" fill="#f472b6" />
          <circle cx="25.6" cy="27.5" r="1.8" fill="#e879f9" />
          <circle cx="25.6" cy="36.5" r="1.8" fill="#e879f9" />
        </svg>
      </span>
      {boss ? <span className="text-[8px] leading-none font-bold tracking-wide">BOSS</span> : null}
    </span>
  );
}

export function BlueNoteIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={"shrink-0 " + className} aria-hidden>
      <ellipse cx="18" cy="46" rx="8" ry="5.4" fill="#1a4ae0" transform="rotate(-18 18 46)" />
      <ellipse cx="46" cy="46" rx="8" ry="5.4" fill="#1a4ae0" transform="rotate(-18 46 46)" />
      <rect x="22.2" y="14" width="3.4" height="32" rx="0.6" fill="#1a4ae0" />
      <rect x="50.2" y="14" width="3.4" height="32" rx="0.6" fill="#1a4ae0" />
      <rect x="22" y="12" width="32" height="6.2" rx="1.2" fill="#1a4ae0" />
    </svg>
  );
}

function RaiderIcon({ flip, className = "" }: { flip: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"shrink-0 " + className} aria-hidden>
      <g fill="currentColor" transform={flip ? "translate(0 24) scale(1 -1)" : undefined}>
        <path
          fillRule="evenodd"
          d="M5.2 7.4C5.2 4.6 7.2 3.4 9.6 3.5l5.6-.4c2.6-.1 4.2 1.6 4.2 4.2v7.4c0 2.8-1.8 4.6-4.6 4.6H8.6c-2.6 0-4-1.6-3.8-4.2l.4-7.7zM7.3 7.5h8.4v6.5H7.3z"
        />
        <rect x="10.85" y="7.5" width="1.35" height="6.5" />
        <path d="M18.2 12.4h2.2a1.7 1.7 0 0 1 0 3.4h-1.1v1.5h-1.7v-1.2h-.4z" />
        <rect x="6.1" y="18.5" width="3.5" height="2.3" rx="1.1" />
        <rect x="12.2" y="18.5" width="3.5" height="2.3" rx="1.1" />
      </g>
    </svg>
  );
}

function HammerIcon({ flip, className = "" }: { flip: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={"shrink-0 " + className} aria-hidden>
      <g fill="currentColor" transform={flip ? "translate(0 24) scale(1 -1)" : undefined}>
        <rect x="11.15" y="0.6" width="1.7" height="12.4" rx="0.45" />
        <ellipse cx="16.8" cy="17.7" rx="2.05" ry="3.7" />
        <rect x="7.5" y="15.15" width="7.6" height="5.1" rx="0.7" />
        <ellipse cx="6.9" cy="17.7" rx="2.45" ry="4.55" />
        <rect x="10.2" y="12.4" width="3.6" height="3.1" rx="0.45" />
      </g>
    </svg>
  );
}

/** Original round note chips. Not game sprites. */
export function NoteIcon({ noteKey, className = "size-6" }: { noteKey: string; className?: string }) {
  if (noteKey === "0H" || noteKey === "18") return <GearIcon half={false} boss={noteKey === "18"} className={className} />;
  if (noteKey === "23") return <BlueNoteIcon className={className} />;
  if (noteKey === "0D" || noteKey === "0J") return <HammerIcon flip={noteKey === "0J"} className={className} />;
  if (noteKey === "0C" || noteKey === "0I") return <RaiderIcon flip={noteKey === "0I"} className={className} />;
  const dir = NOTE_BY_KEY[noteKey]?.dir;
  const bullet = noteKey === "30" || noteKey === "34" || noteKey === "38";
  return (
    <svg viewBox="0 0 24 24" className={"shrink-0 " + className} aria-hidden>
      <circle cx="12" cy="12" r={dir || bullet ? "8.1" : "9.2"} fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g transform={FLIP.has(noteKey) ? "rotate(180 12 12)" : undefined}>{mark(noteKey)}</g>
      {bullet ? <path d="M3.2 12h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> : null}
      {dir === "up" ? <path d="M12 1.15 14.3 4.15H9.7Z" fill="currentColor" /> : null}
      {dir === "down" ? <path d="M12 22.85 9.7 19.85h4.6Z" fill="currentColor" /> : null}
    </svg>
  );
}

const STAR = "12,3.2 14.5,9.2 20.8,9.6 16.1,13.6 17.6,19.8 12,16.4 6.4,19.8 7.9,13.6 3.2,9.6 9.5,9.2";

export function noteFill(lane: LaneId): string {
  if (lane === "air" || lane === "air2") return "#55d8ff";
  if (lane === "gnd" || lane === "gnd2") return "#f95adc";
  if (lane === "boss" || lane === "boss2") return "#ffd15c";
  return "#f4efe8";
}

function EndCap({ color, size, side, children }: { color: string; size: number; side: "left" | "right"; children: ReactNode }) {
  return (
    <span
      className="absolute top-1/2 grid place-items-center rounded-full"
      style={{ width: size, height: size, [side]: 0, transform: "translateY(-50%)", background: color }}
    >
      {children}
    </span>
  );
}

function Rail({ color, size, lines }: { color: string; size: number; lines: number }) {
  const ys = lines === 1 ? [12] : Array.from({ length: lines }, (_, index) => 2 + (index * 20) / (lines - 1));
  return (
    <svg
      className="absolute top-1/2 -translate-y-1/2"
      style={{ left: size / 2, width: `calc(100% - ${size}px)`, height: lines === 1 ? Math.max(6, size * 0.28) : Math.max(10, size * 0.5) }}
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden
    >
      {ys.map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke={color} strokeWidth={lines === 1 ? 10 : 2} />
      ))}
    </svg>
  );
}

/** Flat circle, black star, four plain lines. */
export function HoldNote({ lane, size }: { lane: LaneId; size: number }) {
  const color = noteFill(lane);
  return (
    <span className="pointer-events-none absolute inset-0">
      <Rail color={color} size={size} lines={4} />
      <EndCap color={color} size={size} side="left">
        <svg viewBox="0 0 24 24" className="h-[64%] w-[64%]" aria-hidden>
          <polygon points={STAR} fill="#000" />
        </svg>
      </EndCap>
      <EndCap color={color} size={size} side="right">
        <svg viewBox="0 0 24 24" className="h-[64%] w-[64%]" aria-hidden>
          <polygon points={STAR} fill="#000" />
        </svg>
      </EndCap>
    </span>
  );
}

function GloveMark() {
  return <image href="/glove.png?v=4" x="0.3" y="2.6" width="23.4" height="18.8" />;
}

function Zigzag({ color, size, id }: { color: string; size: number; id: string }) {
  return (
    <svg
      className="absolute top-1/2 -translate-y-1/2"
      style={{ left: size / 2, width: `calc(100% - ${size}px)`, height: 14 }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <polyline points="0,12 7,2 14,12" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="miter" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Masher: boxing glove on each end, zigzag between them. */
export function MasherNote({ lane, size }: { lane: LaneId; size: number }) {
  const color = noteFill(lane);
  const mark = (
    <svg viewBox="0 0 24 24" className="h-[82%] w-[82%]" aria-hidden>
      <GloveMark />
    </svg>
  );
  return (
    <span className="pointer-events-none absolute inset-0">
      <Zigzag color={color} size={size} id={`zag-${lane}`} />
      <EndCap color={color} size={size} side="left">
        {mark}
      </EndCap>
      <EndCap color={color} size={size} side="right">
        {mark}
      </EndCap>
    </span>
  );
}
