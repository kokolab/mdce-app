import { useEffect, useState } from "react";
import { noteLabel, type LaneId } from "@/lib/md/catalog";
import { player } from "@/lib/md/player";
import { useChart } from "@/lib/md/store";
import { playbackPoints, secondsAt } from "@/lib/md/timing";
import { NoteIcon } from "./NoteIcon";

const LOOK = 1.35;

function laneClass(lane: LaneId): string {
  if (lane === "air" || lane === "air2") return "top-1/4 bg-airnote text-black";
  if (lane === "gnd" || lane === "gnd2") return "top-2/3 bg-gndnote text-black";
  if (lane === "boss" || lane === "boss2") return "top-1/2 bg-gold text-ink";
  return "top-3/4 bg-paper text-ink";
}

export function Stage() {
  const notes = useChart((state) => state.notes);
  const showIcons = useChart((state) => state.showIcons);
  const bpm = useChart((state) => state.meta.bpm);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (time - last < 48) return;
      last = time;
      const state = useChart.getState();
      const points = playbackPoints(state.notes, state.meta.bpm, state.playBpm);
      setNow(secondsAt(player.tickFor(points), points));
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const playBpm = useChart((state) => state.playBpm);
  const points = playbackPoints(notes, bpm, playBpm);

  return (
    <div className="sticky top-0 z-20 h-20 overflow-hidden border-b border-line bg-ink lg:h-36" aria-label="Chart preview">
      <div className="absolute top-1/4 right-4 left-16 h-px bg-line" />
      <div className="absolute top-2/3 right-4 left-16 h-px bg-line" />
      <div className="absolute top-3 bottom-3 left-16 w-0.5 bg-paper" />
      <div className="absolute top-1/2 left-6 size-5 -translate-y-1/2 rounded-full bg-pink" />
      <div className="absolute top-1/2 left-5 h-4 w-3 translate-y-2 rounded-sm bg-paper" />
      {notes.map((note) => {
        if (note.lane === "bpm" || note.key === "10") return null;
        const dt = secondsAt(note.tick, points) - now;
        if (dt < -0.12 || dt > LOOK) return null;
        const left = 18 + (dt / LOOK) * 76;
        return (
          <span
            key={note.id}
            className={
              "absolute grid size-8 -translate-y-1/2 place-items-center " +
              (showIcons ? "rounded-full " : "rounded-md px-1.5 font-mono text-xs font-medium ") +
              laneClass(note.lane)
            }
            style={{ left: `${left}%` }}
          >
            {showIcons ? <NoteIcon noteKey={note.key} className="size-6" /> : noteLabel(note.key)}
          </span>
        );
      })}
    </div>
  );
}
