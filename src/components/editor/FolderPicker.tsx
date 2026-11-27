import { DropDown } from "./DropDown";

export function FolderPicker({
  folders,
  recents,
  root,
  value,
  onChange,
  onChooseRoot,
  onLink,
  onBrowse,
  onClear,
  onCancel,
}: {
  folders: string[];
  recents: { path: string; label: string }[];
  root?: string;
  value: string;
  onChange: (name: string) => void;
  onChooseRoot?: (path: string) => void;
  onLink: () => void;
  onBrowse?: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-dock-line bg-dock p-4 text-dock-ink shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-dock-ink">Link chart folder</h2>
        <p className="mt-1 text-sm text-mute">Pick a song folder. Folders you have linked stay in the list.</p>
        {recents.length ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <span>Recent chart folders</span>
            <DropDown
              ariaLabel="Recent chart folders"
              className="h-11 w-full border border-dock-line text-base"
              value={root || ""}
              options={recents.map((item) => ({ value: item.path, label: item.label }))}
              onChange={(path) => onChooseRoot?.(path)}
            />
          </div>
        ) : null}
        {root ? (
          <p className="mt-2 truncate font-mono text-xs text-mute" title={root}>
            {root}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <span>Song</span>
          <DropDown
            ariaLabel="Song folder"
            className="h-11 w-full border border-dock-line text-base"
            value={value}
            options={folders.map((name) => ({ value: name, label: name }))}
            onChange={onChange}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {onBrowse ? (
            <button type="button" className="mr-auto h-10 rounded border border-dock-line px-4 text-sm" onClick={onBrowse}>
              Choose folder
            </button>
          ) : null}
          <button type="button" className="h-10 rounded border border-dock-line px-4 text-sm" onClick={onClear}>
            Clear link
          </button>
          <button type="button" className="h-10 rounded border border-dock-line px-4 text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="h-10 rounded bg-paper px-4 text-sm font-semibold text-ink" onClick={onLink} disabled={!value}>
            Link
          </button>
        </div>
      </div>
    </div>
  );
}
