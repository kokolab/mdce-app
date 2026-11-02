export function FolderPicker({
  folders,
  value,
  onChange,
  onLink,
  onClear,
  onCancel,
}: {
  folders: string[];
  value: string;
  onChange: (name: string) => void;
  onLink: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-dock-line bg-dock p-4 text-dock-ink shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-paper">Link chart folder</h2>
        <p className="mt-1 text-sm text-mute">Pick a folder from Custom_Albums on the NAS.</p>
        <label className="mt-4 flex flex-col gap-2 text-sm">
          <span>Available folders</span>
          <select
            className="h-11 rounded border border-dock-line bg-field px-3 text-base text-dock-ink"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoFocus
          >
            {folders.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="h-10 rounded border border-dock-line px-4 text-sm" onClick={onClear}>
            Clear link
          </button>
          <button type="button" className="h-10 rounded border border-dock-line px-4 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="h-10 rounded bg-paper px-4 text-sm font-semibold text-ink" onClick={onLink}>
            Link
          </button>
        </div>
      </div>
    </div>
  );
}
