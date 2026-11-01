import { SCENES } from "@/lib/md/catalog";
import { useChart } from "@/lib/md/store";
import type { Meta } from "@/lib/md/bms";

const FIELDS: { key: keyof Meta; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "designer", label: "Chart by" },
];

export function SongCard({ className = "" }: { className?: string }) {
  const meta = useChart((state) => state.meta);
  const patchMeta = useChart((state) => state.patchMeta);
  const known = SCENES.some((scene) => scene.id === meta.genre);

  return (
    <form className={"flex flex-col gap-3 " + className} onSubmit={(event) => event.preventDefault()}>
      <div>
        <h2 className="text-lg font-semibold">Header</h2>
        <p className="text-xs text-mute">Written into the chart and info.json.</p>
      </div>
      {FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 text-sm">
          <span className="text-mute">{field.label}</span>
          <input
            value={String(meta[field.key])}
            onChange={(event) => patchMeta({ [field.key]: event.target.value })}
            className="h-11 rounded-md border border-line bg-ink px-3 text-paper"
          />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-mute">BPM</span>
        <input
          type="number"
          min={1}
          max={999}
          value={meta.bpm}
          onChange={(event) => patchMeta({ bpm: Number(event.target.value) || 1 })}
          className="h-11 rounded-md border border-line bg-ink px-3 font-mono text-paper"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-mute">Level</span>
        <input
          value={meta.playlevel}
          onChange={(event) => patchMeta({ playlevel: event.target.value })}
          className="h-11 rounded-md border border-line bg-ink px-3 font-mono text-paper"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-mute">Scene</span>
        <select
          value={known ? meta.genre : "custom"}
          onChange={(event) => {
            if (event.target.value !== "custom") useChart.getState().setScene(event.target.value);
          }}
          className="h-11 rounded-md border border-line bg-ink px-3 text-paper"
        >
          {SCENES.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.label}
            </option>
          ))}
          <option value="custom">Custom id</option>
        </select>
        <input
          value={meta.genre}
          onChange={(event) => patchMeta({ genre: event.target.value })}
          className="h-11 rounded-md border border-line bg-ink px-3 font-mono text-paper"
          spellCheck={false}
        />
      </label>
      <div className="grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as const).map((index) => {
          const key = `difficulty${index}` as const;
          return (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-mute">{index}</span>
              <input
                value={meta[key]}
                onChange={(event) => patchMeta({ [key]: event.target.value })}
                className="h-11 rounded-md border border-line bg-ink px-2 text-center font-mono text-paper"
              />
            </label>
          );
        })}
      </div>
      <p className="text-xs text-mute">Difficulties 1–4. The second is the one custom charts usually show.</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-mute">Tags</span>
        <input
          value={meta.tags}
          onChange={(event) => patchMeta({ tags: event.target.value })}
          className="h-11 rounded-md border border-line bg-ink px-3 text-paper"
          placeholder="comma separated"
        />
      </label>
    </form>
  );
}
