# MDCE for Windows

Standalone Windows build of the Stagepen chart editor (Muse Dash custom BMS maps). The editor UI is the same as the website. The app does not create a chart folder. **File → Link chart folder** opens a folder dialog so you can select the folder you already have (the same step as linking a folder on the website). Song folders inside it are then listed for you to link.

Saving a linked chart writes `map*.bms` and `info.json` back into that existing song folder.

## Install a release

1. Open the [Releases](https://github.com/kokolab/mdce-windows/releases) page.
2. Download `MDCE_0.1.0_x64_setup.exe`.
3. Run it. WebView2 is installed automatically if Windows does not already have it (Windows 10/11 usually do).
4. In MDCE: **File → Link chart folder**, select your existing chart folder, pick the song, then **Link**.

## Build it yourself

Requirements:

- Windows 10 or 11, 64-bit
- [Node.js 22](https://nodejs.org/)
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload
- WebView2 (the Evergreen runtime). The NSIS installer can bootstrap it.

```bat
git clone https://github.com/kokolab/mdce-windows.git
cd mdce-windows
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

Dev and installed builds use the folder you select. The app does not create one.

## What changed from the website

- Native window via [Tauri 2](https://v2.tauri.app/).
- `File → Link chart folder` asks you to select an existing folder, then lists the song folders inside it.
- Song audio in the linked folder is loaded from disk the same way.

The website repo stays [kokolab/mdce](https://github.com/kokolab/mdce). This repository is the Windows edition.
