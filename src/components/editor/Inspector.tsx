import { useState, type ReactNode } from "react";
import { SCENES, WAV_HEADER, noteName } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";
import { formatClock, locate, secondsAt, tempoPoints } from "@/lib/md/timing";

const SPEEDS = [
  { key: "0O", label: "Speed 1" },
  { key: "0P", label: "Speed 2" },
  { key: "0Q", label: "Speed 3" },
];

const DIFFICULTIES = ["Easy", "Normal", "Hard", "Master"];

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
  const followPlay = useChart((state) => state.followPlay);
  const followTight = useChart((state) => state.followTight);
  const followAmount = useChart((state) => state.followAmount);
  const bgmSpeed = useChart((state) => state.bgmSpeed);
  const musicOffset = useChart((state) => state.musicOffset);
  const showIcons = useChart((state) => state.showIcons);
  const brush = useChart((state) => state.brush);
  const bgmVolume = useChart((state) => state.bgmVolume);
  const sfxVolume = useChart((state) => state.sfxVolume);
  const notes = useChart((state) => state.notes);
  const selectedId = useChart((state) => state.selectedId);
  const selection = useChart((state) => state.selection);
  const sigs = useChart((state) => state.sigs);
  const measureCount = useChart((state) => state.measureCount);
  const [bar, setBar] = useState("0");
  const [headerMore, setHeaderMore] = useState(false);
  const [gridMore, setGridMore] = useState(false);
  const [wavMore, setWavMore] = useState(true);
  const knownScene = SCENES.some((scene) => scene.id === meta.genre);
  const speed = notes.find((note) => note.lane === "boss" && note.tick === 0 && SPEEDS.some((item) => item.key === note.key));
  const selected = notes.find((note) => note.id === selectedId);
  const spot = selected ? locate(selected.tick, sigs, measureCount) : null;

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
            <option value="custom">{meta.genre || "Custom"}</option>
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
            value={speed?.key ?? ""}
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
            value={DIFFICULTIES.includes(meta.difficulty2) ? meta.difficulty2 : "custom"}
            onChange={(event) => {
              if (event.target.value !== "custom") patchMeta({ difficulty2: event.target.value });
            }}
            className={field}
          >
            {DIFFICULTIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="custom">{meta.difficulty2 || "Custom"}</option>
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
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-0.5 text-[11px]">
            Divide
            <input
              type="number"
              min={1}
              max={192}
              value={divide}
              aria-label="Grid divide"
              onChange={(event) => useChart.getState().setDivide(Number(event.target.value) || 1)}
              className="h-7 w-16 rounded border border-dock-line bg-field px-1 font-mono text-xs text-dock-ink"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            Sub
            <input
              type="number"
              min={1}
              max={48}
              value={sub}
              aria-label="Grid sub"
              onChange={(event) => useChart.getState().setSub(Number(event.target.value) || 1)}
              className="h-7 w-16 rounded border border-dock-line bg-field px-1 font-mono text-xs text-dock-ink"
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
            step={0.25}
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
      </Group>

      <Group title="#WAV">
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">BGM Speed</span>
          <input type="range" min={0.25} max={2} step={0.05} value={bgmSpeed} aria-label="BGM speed" onChange={(event) => useChart.getState().setBgmSpeed(Number(event.target.value))} className="min-w-0 flex-1" />
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
        <label className="flex h-6 items-center gap-2 text-xs">
          <input type="checkbox" checked={followPlay} onChange={(event) => useChart.getState().setFollowPlay(event.target.checked)} />
          Follow Play line
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <input type="checkbox" checked={followTight} onChange={(event) => useChart.getState().setFollowTight(event.target.checked)} />
          Real-time follow play line
        </label>
        <label className="flex h-7 items-center gap-2 text-xs">
          <span className="w-[4.5rem] shrink-0 text-right">Follow</span>
          <input type="range" min={0} max={1} step={0.05} value={followAmount} aria-label="Follow amount" onChange={(event) => useChart.getState().setFollowAmount(Number(event.target.value))} className="min-w-0 flex-1" />
          <span className="w-8 font-mono">{followAmount.toFixed(2)}</span>
        </label>
        <div className="flex gap-1">
          <button type="button" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs" onClick={() => useChart.getState().copySelected()}>
            Copy
          </button>
          <button type="button" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs" onClick={() => useChart.getState().pasteClipboard()}>
            Paste
          </button>
          <button type="button" className="h-7 flex-1 rounded border border-dock-line bg-field text-xs" onClick={() => useChart.getState().setShowIcons(!showIcons)}>
            {showIcons ? "Icons" : "Text"}
          </button>
        </div>
        <p className="font-mono text-[11px] text-mute">
          {selected && spot
            ? `${selection.length > 1 ? `${selection.length} notes · ` : ""}${noteName(selected.key)} · ${String(spot.measure).padStart(3, "0")} · ${formatClock(secondsAt(selected.tick, tempoPoints(notes, meta.bpm)))}`
            : "Shift-click adds notes to the group."}
        </p>
        <button type="button" className="h-7 w-full rounded border border-dock-line bg-field text-xs" onClick={() => setWavMore(!wavMore)}>
          Expand...
        </button>
        {wavMore ? (
          <div className="max-h-64 overflow-y-auto rounded border border-dock-line bg-field">
            {WAV_HEADER.map((item) => {
              const on = brush === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => useChart.getState().setBrush(item.key)}
                  className={"flex h-6 w-full items-center px-2 text-left font-mono text-[11px] " + (on ? "bg-pink text-ink" : "")}
                >
                  {item.key}: {item.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </Group>
    </div>
  );
}
