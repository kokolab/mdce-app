# MDCE

MDCE (Muse Dash Chart Editor) is an editor for Muse Dash custom charts on Windows and Linux.

You place notes on a timing grid, set the song header, and play the chart against its music. **File → Link chart folder** connects a song folder on your computer. MDCE lists the songs in that folder, opens the chart you pick, and saves the chart and `info.json` back into that song folder.

## Install

Open the [Releases](https://github.com/kokolab/mdce-windows/releases) page. `SHA256.txt` lists the checksum for each file.

Windows:

1. Download `MDCE_0.1.1_x64_setup.exe`.
2. Run it. WebView2 is installed automatically if Windows does not already have it (Windows 10 and 11 usually do).
3. In MDCE: **File → Link chart folder**, select your chart folder, pick the song, then **Link**.

Linux:

- Debian, Ubuntu, and Mint: `MDCE_0.1.1_amd64.deb`
- Fedora and openSUSE: `MDCE_0.1.1_x86_64.rpm`
- Any other desktop: `MDCE_0.1.1_amd64.AppImage`. Install WebKitGTK 4.1 first. If the AppImage does not start, install FUSE (`libfuse2` on Debian and Ubuntu).

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

The Windows installer is written to `src-tauri\target\release\bundle\nsis\`.

On Linux the same command writes `.deb`, `.rpm`, and `.AppImage` under `src-tauri/target/release/bundle/`. Install WebKitGTK 4.1 and a C build toolchain first.

While developing:

```bat
npm run tauri:dev
```
