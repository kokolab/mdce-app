import type { ReactNode } from "react";
import { NOTE_BY_KEY, type LaneId } from "@/lib/md/catalog";

const FLIP = new Set(["0I", "0J"]);

function SwordMark() {
  return (
    <g fill="currentColor">
      <path d="M11.15 1.6h1.7l-.35 11.2h-1z" />
      <rect x="6.4" y="12.2" width="11.2" height="1.8" rx="0.4" />
      <rect x="10.85" y="13.8" width="2.3" height="4.6" rx="0.4" />
      <circle cx="12" cy="20.2" r="1.45" />
    </g>
  );
}

export function bossMark(key: string): string | null {
  if (key === "11" || key === "16") return "BM1";
  if (key === "12" || key === "17") return "BM2";
  return null;
}

export function BossBadge({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute bottom-[7%] left-1/2 z-20 -translate-x-1/2 rounded-sm bg-ink/85 px-0.5 font-mono text-[8px] font-bold leading-none text-paper">
      {text}
    </span>
  );
}

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
    case "0F":
      return <polygon points="12,4.2 14.1,9.2 19.4,9.5 15.4,12.8 16.7,18 12,15.2 7.3,18 8.6,12.8 4.6,9.5 9.9,9.2" fill="currentColor" />;
    case "0G":
    case "16":
    case "17":
      return <GloveMark />;
    case "11":
    case "12":
      return <SwordMark />;
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
          <g fill="currentColor">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <polygon key={angle} points="32,1.5 25.5,16 38.5,16" transform={`rotate(${angle} 32 32)`} />
            ))}
            <circle cx="32" cy="32" r="19" />
            <circle cx="32" cy="32" r="14.5" />
            <circle cx="32" cy="32" r="10" />
            <rect x="30.1" y="17.5" width="3.8" height="29" rx="1.6" />
            <circle cx="25.6" cy="27.5" r="1.8" />
            <circle cx="25.6" cy="36.5" r="1.8" />
          </g>
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

export function GeminiIcon({ up = false, className = "" }: { up?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={"shrink-0 " + className} aria-hidden>
      <g fill="currentColor" transform={up ? "translate(0 32) scale(1 -1)" : undefined}>
        <path
          fillRule="evenodd"
          d="M16 4.6a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2zM10.6 10.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z"
        />
        <circle cx="10.6" cy="12.9" r="1.15" />
        <path d="M8.4 14.4 4.2 18.4 10 16.6zM23.6 14.4 27.8 18.4 22 16.6z" />
        <path d="M13.4 19h5.2l-.9 2.5h-3.4z" />
        <circle cx="16" cy="24.6" r="2.2" />
      </g>
    </svg>
  );
}

function RaiderIcon({ flip, className = "" }: { flip: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={"shrink-0 " + className} aria-hidden>
      <g fill="currentColor" transform={flip ? "translate(0 40) scale(1 -1)" : undefined}>
        <path
          fillRule="evenodd"
          d="M9 11.5C9 6.2 13 3.2 18 3.2h8.2c4.6 0 7.6 2.8 7.6 7.4v12.2c0 4.4-3 7.2-7.6 7.2H15.2c-4.6 0-7.4-2.8-7.2-7.2l1-11.3zM11.2 13.2h16.2c1 0 1.6.7 1.6 1.6v8.2c0 .9-.6 1.6-1.6 1.6H11.2c-1 0-1.6-.7-1.6-1.6v-8.2c0-.9.6-1.6 1.6-1.6z"
        />
        <rect x="17.3" y="13.2" width="2.5" height="11.4" rx="0.6" />
        <path d="M32.4 19.2h3.2c1.5 0 2.6 1.3 2.6 2.9v1.6c0 1.5-1.1 2.7-2.6 2.7h-1.4v2.4h-2.6v-2c0-.8.2-1.2.8-1.4v-6.2z" />
        <rect x="9.2" y="31.4" width="7.4" height="4.4" rx="2.2" />
        <rect x="20.2" y="31.4" width="7.4" height="4.4" rx="2.2" />
      </g>
    </svg>
  );
}

export function GhostIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={"shrink-0 " + className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M21.8 2 L34.4 2 L40.2 3.9 L44.1 6.4 L48.9 11.7 L52.3 19.4 L54.3 33.9 L62 50.9 L61.5 53.8 L58.6 55.2 L49.9 55.2 L43.6 59.6 L35.9 57.6 L33.5 58.1 L28.1 61.5 L24.3 61.5 L17.5 57.2 L12.2 58.1 L8.8 57.2 L5.9 51.4 L2.5 35.4 L2 23.3 L3 18.5 L5.9 11.7 L9.7 7.3 L15.5 3.5 L21.4 2.5 Z M6.4 26.2 a 4.6 3.5 0 1 0 9.2 0 a 4.6 3.5 0 1 0 -9.2 0 Z M22.6 26.4 a 4.6 3.5 0 1 0 9.2 0 a 4.6 3.5 0 1 0 -9.2 0 Z M23.8 36.4 L26.7 36.4 L28.6 39.7 L27.6 40.7 L17 40.2 L18.5 36.8 L23.3 36.8 Z"
      />
      <circle cx="11" cy="26.2" r="1.55" fill="currentColor" />
      <circle cx="27.2" cy="26.4" r="1.55" fill="currentColor" />
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

export function NoteIcon({ noteKey, className = "size-6" }: { noteKey: string; className?: string }) {
  if (noteKey === "0H" || noteKey === "18") return <GearIcon half={false} boss={noteKey === "18"} className={className} />;
  if (noteKey === "23") return <BlueNoteIcon className={className} />;
  if (noteKey === "0D" || noteKey === "0J") return <HammerIcon flip={false} className={className} />;
  if (noteKey === "0C" || noteKey === "0I") return <RaiderIcon flip={false} className={className} />;
  if (noteKey === "0E") return <GeminiIcon className={className} />;
  if (noteKey === "21") return <GhostIcon className={className} />;
  const dir = NOTE_BY_KEY[noteKey]?.dir;
  const bullet = /^3[0-9A-F]$/.test(noteKey);
  return (
    <svg viewBox="0 0 24 24" className={"shrink-0 " + className} aria-hidden>
      <circle cx="12" cy="12" r={dir || bullet ? "8.1" : "9.2"} fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g transform={FLIP.has(noteKey) ? "rotate(180 12 12)" : undefined}>{mark(noteKey)}</g>
      {bullet ? <path d="M3.2 12h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> : null}
    </svg>
  );
}

const STAR = "12,3.2 14.5,9.2 20.8,9.6 16.1,13.6 17.6,19.8 12,16.4 6.4,19.8 7.9,13.6 3.2,9.6 9.5,9.2";

export function ApproachArrow({ dir, lane }: { dir: "up" | "down"; lane: LaneId }) {
  const down = dir === "down";
  return (
    <span className="pointer-events-none absolute bottom-[4%] left-1/2 z-20 w-[42%] -translate-x-1/2">
      <svg viewBox="0 0 24 24" className="block w-full" style={{ transform: `rotate(${down ? 135 : -135}deg)` }} aria-hidden>
        <path d="M3.5 5.2 19.2 12 3.5 18.8 7.2 12Z" fill={noteFill(lane)} stroke="#160814" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

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

/** Flat circle, black star, four plain lines. A one-tap hold keeps the head and a short stub. */
export function HoldNote({ lane, size, tap = false }: { lane: LaneId; size: number; tap?: boolean }) {
  const color = noteFill(lane);
  const mark = (
    <svg viewBox="0 0 24 24" className="h-[64%] w-[64%]" aria-hidden>
      <polygon points={STAR} fill="#000" />
    </svg>
  );
  if (tap) {
    return (
      <span className="pointer-events-none absolute inset-0">
        <span className="absolute top-1/2 -translate-y-1/2 overflow-hidden" style={{ left: size / 2, width: 14, height: Math.max(10, size * 0.5) }}>
          <Rail color={color} size={0} lines={4} />
        </span>
        <EndCap color={color} size={size} side="left">
          {mark}
        </EndCap>
      </span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-0">
      <Rail color={color} size={size} lines={4} />
      <EndCap color={color} size={size} side="left">
        {mark}
      </EndCap>
      <EndCap color={color} size={size} side="right">
        {mark}
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

/** Masher: boxing glove on each end, zigzag between them. A one-tap masher keeps one glove and a short zigzag. */
export function MasherNote({ lane, size, noteKey = "0G", tap = false }: { lane: LaneId; size: number; noteKey?: string; tap?: boolean }) {
  const color = noteFill(lane);
  const mark = (
    <svg viewBox="0 0 24 24" className="h-[82%] w-[82%]" aria-hidden>
      <GloveMark />
    </svg>
  );
  const badge = bossMark(noteKey);
  if (tap) {
    return (
      <span className="pointer-events-none absolute inset-0">
        <span className="absolute top-1/2 -translate-y-1/2 overflow-hidden" style={{ left: size / 2, width: 16, height: 14 }}>
          <Zigzag color={color} size={0} id={`zag-tap-${lane}`} />
        </span>
        <EndCap color={color} size={size} side="left">
          {mark}
          {badge ? <BossBadge text={badge} /> : null}
        </EndCap>
      </span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-0">
      <Zigzag color={color} size={size} id={`zag-${lane}`} />
      <EndCap color={color} size={size} side="left">
        {mark}
        {badge ? <BossBadge text={badge} /> : null}
      </EndCap>
      <EndCap color={color} size={size} side="right">
        {mark}
        {badge ? <BossBadge text={badge} /> : null}
      </EndCap>
    </span>
  );
}
