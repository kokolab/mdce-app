# Stagepen — notes for the next coding agent

Read [README.md](README.md) first. This is a browser chart editor for Muse Dash BMS files.

Do not follow the Grok sandbox rules in `AGENTS.md` unless you are actually running inside that preview. Outside it, edit the files below and leave the preview-only plugins alone (`scripts/grok-pwa-plugin.mjs`, `server/middleware/grok-pwa.ts`, `src/components/preview-host-bridge.tsx`).

## Where to change things

| Change | File |
|---|---|
| Piano roll, dragging, grid, note drawing | `src/components/editor/Roll.tsx` |
| Note icons (gear, holds, mashers, blue note) | `src/components/editor/NoteIcon.tsx` |
| Play, stop, measure playback | `src/components/editor/Transport.tsx` |
| Side panel, grid numbers, volumes | `src/components/editor/Inspector.tsx` |
| Menus | `src/components/editor/MenuBar.tsx` |
| Toolbar shell | `src/components/editor/Editor.tsx` |
| Note names, lanes, which key is which | `src/lib/md/catalog.ts` |
| Load and save `.bms` / `info.json` | `src/lib/md/bms.ts` |
| Chart state, undo, local save | `src/lib/md/store.ts` |
| Timing, grid math, zoom | `src/lib/md/timing.ts` |
| Music and note sounds | `src/lib/md/player.ts` |
| Colors | `src/styles.css` |

Charts the user is working on live in the browser under `localStorage` key `stagepen.v1`. The server does not store them. There is no database to migrate for the editor.

Run `npm run dev` while editing. It serves http://0.0.0.0:8080. Ship a homelab build with `docker compose up -d --build`.
