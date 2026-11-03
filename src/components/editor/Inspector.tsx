import { useState, type ReactNode } from "react";
import { SCENES, normalizeScene } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";
import { rememberInfo } from "@/lib/md/bms";
import { chartOrigin } from "@/lib/md/pack";
import { syncedSongName, writeChartFile } from "@/lib/md/chartFolder";

const SPEEDS = [
  { id: "1", label: "Speed 1" },
  { id: "2", label: "Speed 2" },
  { id: "3", label: "Speed 3" },
];

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
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/** Shared label column so Header / Grid / Volume line up. */
const LABEL = "w-[4.75rem] shrink-0 text-right text-xs text-dock-ink/80";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex h-7 min-w-0 items-center gap-2">
      <span className={LABEL}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </label>
  );
}

const field = "h-7 min-w-0 flex-1 rounded border border-dock-line bg-field px-2 text-xs text-dock-ink";
const mono = field + " font-mono";
const value = "w-9 shrink-0 text-right font-mono text-xs tabular-nums text-dock-ink";

function downloadInfoJson() {
  const text = useChart.getState().exportInfo();
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "info.json";
  link.click();
  URL.revokeObjectURL(url);
  useChart.getState().setBanner("Downloaded info.json.");
}

function jsonErrorMessage(err: unknown, source: string): string {
  const message = err instanceof Error ? err.message : "Invalid JSON";
  const match = /position\s+(\d+)/i.exec(message) || /at position\s+(\d+)/i.exec(message);
  if (match) {
    const pos = Number(match[1]);
    const line = source.slice(0, pos).split("\n").length;
    return `Invalid JSON at line ${line}: ${message}`;
  }
  return `Invalid JSON — ${message}`;
}

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
  const [bar, setBar] = useState("0");
  const [headerMore, setHeaderMore] = useState(false);
  const [gridMore, setGridMore] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const knownScene = SCENES.some((scene) => scene.id === meta.genre);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 text-dock-ink">
      <Group title="Header">
        <Row label="Title">
          <input value={meta.title} onChange={(event) => patchMeta({ title: event.target.value })} className={field} />
        </Row>
        <Row label="Artist">
          <input value={meta.artist} onChange={(event) => patchMeta({ artist: event.target.value })} className={field} />
        </Row>
        <Row label="Scene">
          <select
            value={knownScene ? meta.genre : "custom"}
            onChange={(event) => {
              if (event.target.value !== "custom") useChart.getState().setScene(event.target.value);
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
            className={mono}
          />
        </Row>
        <Row label="Level">
          <input value={meta.playlevel} onChange={(event) => patchMeta({ playlevel: event.target.value })} className={mono} />
        </Row>
        <div className="flex gap-1.5 pl-[calc(4.75rem+0.5rem)]">
          <button
            type="button"
            className="h-7 min-w-0 flex-1 rounded border border-dock-line bg-field text-xs"
            onClick={() => setInfoOpen(true)}
          >
            Edit info.json
          </button>
          <button
            type="button"
            className="h-7 min-w-0 flex-1 rounded border border-dock-line bg-field text-xs"
            onClick={downloadInfoJson}
          >
            Download info.json
          </button>
        </div>
        <div className="pl-[calc(4.75rem+0.5rem)]">
          <button type="button" className="h-7 w-full rounded border border-dock-line bg-field text-xs" onClick={() => setHeaderMore(!headerMore)}>
            {headerMore ? "Collapse…" : "Expand…"}
          </button>
        </div>
        {headerMore ? (
          <div className="flex flex-col gap-1.5 border-t border-dock-line/60 pt-1.5">
            <Row label="ChartDesign">
              <input value={meta.designer} onChange={(event) => patchMeta({ designer: event.target.value })} className={field} />
            </Row>
            <Row label="NoteSpeed">
              <select
                value={meta.noteSpeed || ""}
                onChange={(event) => useChart.getState().setSpeed(event.target.value)}
                className={field}
              >
                <option value="">Not set</option>
                {SPEEDS.map((item) => (
                  <option key={item.id} value={item.id}>
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
            <Row label="Scene id">
              <input value={meta.genre} onChange={(event) => patchMeta({ genre: event.target.value })} className={mono} spellCheck={false} />
            </Row>
            {([1, 2, 3, 4] as const).map((index) => {
              const key = `difficulty${index}` as const;
              return (
                <Row key={key} label={`Diff ${index}`}>
                  <input value={meta[key]} onChange={(event) => patchMeta({ [key]: event.target.value })} className={mono} />
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
        <Row label="Divide">
          <input
            type="number"
            min={1}
            max={192}
            value={divide}
            aria-label="Grid divide"
            onChange={(event) => useChart.getState().setDivide(Number(event.target.value) || 1)}
            className={mono}
          />
        </Row>
        <Row label="Sub">
          <input
            type="number"
            min={1}
            max={48}
            value={sub}
            aria-label="Grid sub"
            onChange={(event) => useChart.getState().setSub(Number(event.target.value) || 1)}
            className={mono}
          />
        </Row>
        <Row label="Height">
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
          <span className={value}>{xHeight.toFixed(2)}</span>
        </Row>
        <Row label="Width">
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
          <span className={value}>{xWidth.toFixed(2)}</span>
        </Row>
        <label className="flex h-6 items-center gap-2 text-xs">
          <span className={LABEL} aria-hidden />
          <input type="checkbox" checked={snapOn} onChange={(event) => useChart.getState().setSnapOn(event.target.checked)} />
          <span>Snap to grid (G)</span>
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <span className={LABEL} aria-hidden />
          <input type="checkbox" checked={lockLane} onChange={(event) => useChart.getState().setLockLane(event.target.checked)} />
          <span>Disable vertical moves (D)</span>
        </label>
        <label className="flex h-6 items-center gap-2 text-xs">
          <span className={LABEL} aria-hidden />
          <input type="checkbox" checked readOnly />
          <span>Horizontal View</span>
        </label>
        <div className="pl-[calc(4.75rem+0.5rem)]">
          <button type="button" className="h-7 w-full rounded border border-dock-line bg-field text-xs" onClick={() => setGridMore(!gridMore)}>
            {gridMore ? "Collapse…" : "Expand…"}
          </button>
        </div>
        {gridMore ? (
          <form
            className="flex gap-1.5 pl-[calc(4.75rem+0.5rem)] pt-0.5"
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
        <Row label="Music">
          <input type="range" min={0} max={1} step={0.05} value={bgmVolume} aria-label="Chart music volume" onChange={(event) => useChart.getState().setMix(Number(event.target.value), sfxVolume)} className="min-w-0 flex-1" />
          <span className={value}>{bgmVolume.toFixed(2)}</span>
        </Row>
        <Row label="Notes">
          <input type="range" min={0} max={1} step={0.05} value={sfxVolume} aria-label="Note sound volume" onChange={(event) => useChart.getState().setMix(bgmVolume, Number(event.target.value))} className="min-w-0 flex-1" />
          <span className={value}>{sfxVolume.toFixed(2)}</span>
        </Row>
        <Row label="Speed">
          <input type="range" min={0.25} max={2} step={0.25} value={bgmSpeed} aria-label="Playback speed" onChange={(event) => useChart.getState().setBgmSpeed(Number(event.target.value))} className="min-w-0 flex-1" />
          <span className={value}>{bgmSpeed.toFixed(2)}</span>
        </Row>
        <Row label="Offset">
          <input
            type="number"
            min={-5000}
            max={5000}
            step={5}
            value={musicOffset}
            aria-label="Music offset in milliseconds"
            onChange={(event) => useChart.getState().setMusicOffset(Number(event.target.value) || 0)}
            className={mono}
          />
          <span className="w-6 shrink-0 text-xs text-mute">ms</span>
        </Row>
      </Group>

      {infoOpen ? <InfoJsonModal onClose={() => setInfoOpen(false)} /> : null}
    </div>
  );
}

function InfoJsonModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(() => useChart.getState().exportInfo());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function formatJson() {
    try {
      const data = JSON.parse(text);
      setText(JSON.stringify(data, null, 2));
      setError("");
    } catch (err) {
      setError(jsonErrorMessage(err, text));
    }
  }

  async function saveAndClose() {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      setError(jsonErrorMessage(err, text));
      return;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      setError("info.json must be a JSON object.");
      return;
    }

    setSaving(true);
    setError("");
    rememberInfo(data);
    const tags = Array.isArray(data.searchTags) ? data.searchTags.map(String).join(", ") : undefined;
    useChart.getState().patchMeta({
      title: typeof data.name === "string" ? data.name : undefined,
      artist: typeof data.author === "string" ? data.author : undefined,
      genre: typeof data.scene === "string" ? normalizeScene(data.scene) : undefined,
      designer: typeof data.levelDesigner === "string" ? data.levelDesigner : undefined,
      tags,
      difficulty1: data.difficulty1 != null ? String(data.difficulty1) : undefined,
      difficulty2: data.difficulty2 != null ? String(data.difficulty2) : undefined,
      difficulty3: data.difficulty3 != null ? String(data.difficulty3) : undefined,
      difficulty4: data.difficulty4 != null ? String(data.difficulty4) : undefined,
      unlockLevel: data.unlockLevel != null ? String(data.unlockLevel) : undefined,
    });

    const origin = chartOrigin();
    const useDisk =
      origin === "linked" || (origin !== "mdm" && origin !== "loose" && Boolean(syncedSongName()));
    if (useDisk) {
      const wrote = await writeChartFile("info.json", text);
      if (wrote === "wrote") {
        useChart.getState().setBanner("Saved info.json.");
      } else if (wrote === "stale") {
        useChart.getState().setBanner("info.json write did not stick — try again.");
      } else if (wrote === "denied") {
        useChart.getState().setBanner("Could not write info.json.");
      } else {
        useChart.getState().setBanner("Applied info.json in the editor. Use Download info.json to download.");
      }
    } else {
      useChart.getState().setBanner("Applied info.json in the editor. Use Download info.json to download.");
    }
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[min(85dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded border border-dock-line bg-field shadow-xl">
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-dock-line px-3">
          <span className="text-sm font-medium text-dock-ink">info.json</span>
          <div className="flex items-center gap-1.5">
            <button type="button" className="h-7 rounded border border-dock-line bg-menubar px-2.5 text-xs text-dock-ink" onClick={formatJson}>
              Format
            </button>
            <button
              type="button"
              className="h-7 rounded border border-dock-line bg-menubar px-2.5 text-xs text-dock-ink disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveAndClose()}
            >
              {saving ? "Saving…" : "Save & Close"}
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none overflow-auto bg-chart p-3 font-mono text-xs leading-relaxed text-paper outline-none"
          aria-label="info.json editor"
        />
        {error ? <p className="shrink-0 border-t border-dock-line px-3 py-1.5 text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
