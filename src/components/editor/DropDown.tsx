import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function DropDown({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 180, maxHeight: 240 });
  const current = options.find((item) => item.value === value);
  const label = current?.label || "None";

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 180);
    const maxHeight = 240;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const openUp = below < 160 && above > below;
    const room = Math.max(80, Math.min(maxHeight, openUp ? above : below));
    setBox({
      top: openUp ? Math.max(8, rect.top - room - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight: room,
    });
  }

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={"mdce-drop flex min-w-0 items-center justify-between gap-2 rounded px-2 text-left " + (className ?? "h-8 w-full border")}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden className="shrink-0 text-[10px] opacity-70">▾</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="mdce-menu fixed z-[200] overflow-auto rounded py-1 shadow-lg"
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            >
              {options.length ? (
                options.map((item) => (
                  <button
                    key={item.value || "empty"}
                    type="button"
                    aria-checked={item.value === value}
                    className="block w-full truncate px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    {item.label || "None"}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm opacity-70">Nothing to list</div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
