import { useState, type ReactNode } from "react";
import { SCENES } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";

const SPEEDS = [
  { key: "0O", label: "Speed 1" },
  { key: "0P", label: "Speed 2" },
  { key: "0Q", label: "Speed 3" },
];

const SPEED_BOTH: Record<string, string> = {
  "0O": "0O",
  "0R": "0O",
  "0U": "0O",
  "0P": "0P",
  "0S": "0P",
  "0V": "0P",
  "0Q": "0Q",
  "0T": "0Q",
  "0W": "0Q",
};

const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "hard", label: "Hard" },
  { id: "master", label: "Master" },
  { id: "hidden", label: "Hidden" },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="groupbox">
      <h2>{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex h-7 items-center gap-2 text-xs">
      <span className="w-[4.5rem] shrink-0 text-right">{label}</span>
      {children}
    </label>
  );
}

const field = "h-7 min-w-0 flex-1 rounded border border-dock-line bg-field px-1.5 text-xs text-dock-ink";

export function Inspector() {
  const meta = useChart((state) => state.meta);
  const patchMeta = useChart((state) => state.patchMeta);
  const snapOn = useChart((state) => state.snapOn);
  const lockLane = useChart((state) => state.lockLane);
  const divide = useChart((state) => state.divide);
  const sub = useChart((state) => state.sub);
  const xWidth = useChart((state) => state.xWidth);
  const xHeight = useChart((state) => state.xHeight);
  const bgmSpeed = useChart((state) => state.bgmSpeed);
  const musicOffset = useChart((state) => state.musicOffset);
  const bgmVolume = useChart((state) => state.bgmVolume);
  const sfxVolume = useChart((state) => state.sfxVolume);
  const notes = useChart((state) => state.notes);
  const [bar, setBar] = useState("0");
  const [headerMore, setHeaderMore] = useState(false);
  const [gridMore, setGridMore] = useState(false);
  const knownScene = SCENES.some((scene) => scene.id === meta.genre);
  const speed = notes
    .filter((note) => SPEED_BOTH[note.key])
    .sort((a, b) => a.tick - b.tick)[0];
  const speedValue = speed ? SPEED_BOTH[speed.key] : "";

  return (
    <div className="text-dock-ink">
      <Group title="Header">
        <Row label="Title">
          <input value={meta.title} onChange={(event) => patchMeta({ title: event.target.value })} className={field} />
        </Row>
        <Row label="Artist">
          <input value={meta.artist} onChange={(event) => patchMeta({ artist: event.target.value })} className={field} />
        </Row>
        <Row label="ChartDesign">
          <input value={meta.designer} onChange={(event) => patchMeta({ designer: event.target.value })} className={field} />
        </Row>
        <Row label="Scene">
          <select
            value={knownScene ? meta.genre : "custom"}
            onChange={(event) => {
              if (event.target.value !== "custom") patchMeta({ genre: event.target.value });
            }}
            className={field}
          >
            {SCENES.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.label}
              </option>
            ))}
            {knownScene ? null : <option value="custom">{meta.genre || "Custom"}</option>}
          </select>
        </Row>
        <Row label="BPM">
          <input
            type="number"
            min={1}
            max={999}
            step={0.001}
            value={meta.bpm}
            onChange={(event) => patchMeta({ bpm: Number(event.target.value) || 1 })}
            className={field + " font-mono"}
          />
        </Row>
        <Row label="NoteSpeed">
          <select
            value={speedValue}
            onChange={(event) => {
              if (event.target.value) useChart.getState().setSpeed(event.target.value);
            }}
            className={field}
          >
            <option value="">Not set</option>
            {SPEEDS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Difficulty">
          <select
            value={meta.chartDifficulty || "hard"}
            onChange={(event) => patchMeta({ chartDifficulty: event.target.value as typeof meta.chartDifficulty })}
            className={field}
          >
            {DIFFICULTIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Level">
          <input value={meta.playlevel} onChange={(event) => patchMeta({ playlevel: event.target.value })} className={field + " font-mono"} />
        </Row>
        <button type="button" className="mt-1 h-7 w-full rounded border border-dock-line bg-field text-xs" onClick={() => setHeaderMore(!headerMore)}>
          Expand...
        </button>
        {headerMore ? (
          <div className="flex flex-col gap-1 pt-1">
            <Row label="Scene id">
              <input value={meta.genre} onChange={(event) => patchMeta({ genre: event.target.value })} className={field + " font-mono"} spellCheck={false} />
            </Row>
            {([1, 2, 3, 4] as const).map((index) => {
              const key = `difficulty${index}` as const;
              return (
                <Row key={key} label={`Diff ${index}`}>
                  <input value={meta[key]} onChange={(event) => patchMeta({ [key]: event.target.value })} className={field + " font-mono"} />
                </Row>
              );
            })}
            <Row label="Tags">
              <input value={meta.tags} onChange={(event) => patchMeta({ tags: event.target.value })} className={field} />
            </Row>
          </div>
        ) : null}
      </Group>

      <Group title="Grid">
        <div className="flex items-end justify-center gap-8">
          <label className="flex flex-col items-center gap-0.5 text-center text-[11px]">
            Divide
            <input
              type="number"
              min={1}
              max={192}
              value={divide}
              aria-label="Grid divide"
              onChange={(event) => useChart.getState().setDivide(Number(event.target.value) || 1)}
              className="h-7 w-16 rounded border border-dock-line bg-field px-1 text-center font-mono text-xs text-dock-ink"
            />
          </label>
          <label className="flex flex-col items-center gap-0.5 text-center text-[11px]">
            Sub
            <input
              type="number"
              min={1}
              max={48}
              value={sub}
              aria-label="Grid sub"
              onChange={(event) => useChart.getState().setSub(Number(event.target.value) || 1)}
              className="h-7 w-16 rounded border border-dock-line bg-field px-1 text-center font-mono text-xs text-dock-ink"
            />
          </label>
        </div>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-3 text-center font-mono" aria-hidden>
            H
          </span>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.25}
            value={xHeight}
            aria-label="Lane height"
            onChange={(event) => useChart.getState().setXHeight(Number(event.target.value))}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono">{xHeight.toFixed(2)}</span>
        </label>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-3 text-center font-mono" aria-hidden>
            W
          </span>
          <input
            type="range"
            min={0.5}
            max={12}
            step={0.1}
            value={xWidth}
            aria-label="Measure width"
            onChange={(event) => useChart.getState().setXWidth(Number(event.target.value))}
            className="min-w-0 flex-1"
          />
          <span className="w-10 font-mono">{xWidth.toFixed(2)}</span>
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <input type="checkbox" checked={snapOn} onChange={(event) => useChart.getState().setSnapOn(event.target.checked)} />
          Snap to grid (G)
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <input type="checkbox" checked={lockLane} onChange={(event) => useChart.getState().setLockLane(event.target.checked)} />
          Disable vertical moves (D)
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <input type="checkbox" checked readOnly />
          Horizontal View
        </label>
        <button type="button" className="mt-1 h-7 w-full rounded border border-dock-line bg-field text-xs" onClick={() => setGridMore(!gridMore)}>
          Expand...
        </button>
        {gridMore ? (
          <form
            className="flex gap-1 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              useChart.getState().gotoMeasure(Number(bar) || 0);
            }}
          >
            <input value={bar} onChange={(event) => setBar(event.target.value)} aria-label="Measure" className="h-7 w-14 rounded border border-dock-line bg-field px-1 font-mono text-xs" />
            <button type="submit" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs">
              Go
            </button>
            <button type="button" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs" onClick={() => useChart.getState().insertMeasure(Number(bar) || 0)}>
              Insert
            </button>
            <button type="button" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs" onClick={() => useChart.getState().removeMeasure(Number(bar) || 0)}>
              Remove
            </button>
          </form>
        ) : null}
      </Group>

      <Group title="Volume">
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">Music</span>
          <input type="range" min={0} max={1} step={0.05} value={bgmVolume} aria-label="Chart music volume" onChange={(event) => useChart.getState().setMix(Number(event.target.value), sfxVolume)} className="min-w-0 flex-1" />
          <span className="w-8 font-mono">{bgmVolume.toFixed(2)}</span>
        </label>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">Notes</span>
          <input type="range" min={0} max={1} step={0.05} value={sfxVolume} aria-label="Note sound volume" onChange={(event) => useChart.getState().setMix(bgmVolume, Number(event.target.value))} className="min-w-0 flex-1" />
          <span className="w-8 font-mono">{sfxVolume.toFixed(2)}</span>
        </label>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">Speed</span>
          <input type="range" min={0.25} max={2} step={0.25} value={bgmSpeed} aria-label="Playback speed" onChange={(event) => useChart.getState().setBgmSpeed(Number(event.target.value))} className="min-w-0 flex-1" />
          <span className="w-8 font-mono">{bgmSpeed.toFixed(2)}</span>
        </label>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">Offset</span>
          <input
            type="number"
            min={-5000}
            max={5000}
            step={5}
            value={musicOffset}
            aria-label="Music offset in milliseconds"
            onChange={(event) => useChart.getState().setMusicOffset(Number(event.target.value) || 0)}
            className="h-7 min-w-0 flex-1 rounded border border-dock-line bg-field px-1 font-mono text-xs"
          />
          <span className="w-8 font-mono">ms</span>
        </label>
      </Group>
    </div>
  );
}
