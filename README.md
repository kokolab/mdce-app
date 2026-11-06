# MDCE

Muse Dash Chart Editor for Windows.

MDCE edits custom charts. It does not create a chart folder. **File → Link chart folder** opens a folder dialog so you can select a folder you already have. Song folders inside it are then listed for you to link.

Saving a linked chart writes the chart files and `info.json` back into that existing song folder.

## Install

1. Open the [Releases](https://github.com/kokolab/mdce-windows/releases) page.
2. Download `MDCE_0.1.0_x64_setup.exe`.
3. Run it. WebView2 is installed automatically if Windows does not already have it (Windows 10 and 11 usually do).
4. In MDCE: **File → Link chart folder**, select your existing chart folder, pick the song, then **Link**.

## Build it yourself

Requirements:

- Windows 10 or 11, 64-bit
- [Node.js 22](https://nodejs.org/)
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload
- WebView2 (the Evergreen runtime). The installer can bootstrap it.

```bat
git clone https://github.com/kokolab/mdce-windows.git
cd mdce-windows
npm ci
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

Dev and installed builds use the folder you select. MDCE does not create one.
