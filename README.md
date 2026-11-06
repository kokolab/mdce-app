# Stagepen for Windows

Standalone Windows build of the Stagepen chart editor (Muse Dash custom BMS maps). The editor UI is the same as the website. Chart folders are **not** read from the homelab API. They live on disk next to the installed program.

```
%LOCALAPPDATA%\Stagepen\stagepen.exe
%LOCALAPPDATA%\Stagepen\Custom_Albums\<song name>\
    map1.bms
    map2.bms
    info.json
    music.ogg
```

The installer is per-user, so that folder is writable without administrator rights. Link chart folder in the app lists every subfolder of `Custom_Albums`.

## Install a release

1. Open the [Releases](https://github.com/kokolab/stagepen-windows/releases) page.
2. Download `Stagepen_*_x64-setup.exe`.
3. Run it. WebView2 is installed automatically if Windows does not already have it (Windows 10/11 usually do).
4. Create a song folder under `Custom_Albums` beside `stagepen.exe`, or copy an extracted `.mdm` there.
5. In Stagepen: **File → Link chart folder**, pick the song, then **Link**.

Saving a linked chart writes `map*.bms` and `info.json` back into that folder.

## Build it yourself

Requirements:

- Windows 10 or 11, 64-bit
- [Node.js 22](https://nodejs.org/)
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload
- WebView2 (the Evergreen runtime). The NSIS installer can bootstrap it.

```bat
git clone https://github.com/kokolab/stagepen-windows.git
cd stagepen-windows
npm ci
npm run desktop:build
npx tauri build
```

The installer is written to:

```
src-tauri\target\release\bundle\nsis\
```

While developing:

```bat
npm run tauri:dev
```

Dev builds read charts from `src-tauri\target\debug\Custom_Albums`, which is the folder next to the debug executable.

## What changed from the website

- Native window via [Tauri 2](https://v2.tauri.app/).
- `File → Link chart folder` talks to Rust (`charts_status`, `charts_folder`, `charts_read`, `charts_write`) instead of `/api/charts`.
- Song audio in the linked folder is loaded from disk the same way.

The website repo stays [kokolab/mdce](https://github.com/kokolab/mdce). This repository is the Windows edition.
