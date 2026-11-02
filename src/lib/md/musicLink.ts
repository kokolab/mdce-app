import { musicFileName } from "./bms";
import { player } from "./player";
import { clearSong, savedSong } from "./songStore";
import { loadLinkedMusic } from "./chartFolder";
import { useChart } from "./store";

const SKIP_BOOT_MUSIC = "mdce-skip-boot-music";

function setSkipBootMusic(skip: boolean) {
  try {
    if (skip) sessionStorage.setItem(SKIP_BOOT_MUSIC, "1");
    else sessionStorage.removeItem(SKIP_BOOT_MUSIC);
  } catch {
    /* private mode */
  }
}

function shouldSkipBootMusic(): boolean {
  try {
    return sessionStorage.getItem(SKIP_BOOT_MUSIC) === "1";
  } catch {
    return false;
  }
}

/** Stop playback and drop in-memory + IndexedDB song so nothing old can keep playing. */
export async function clearLoadedMusic(): Promise<void> {
  player.clearMusic();
  await clearSong().catch(() => undefined);
  useChart.getState().setSongName("");
  // Survive refresh: do not auto-pull linked-folder / IDB audio until the user loads a song again.
  setSkipBootMusic(true);
}

/** Prefer folder music; always replace any previous track. */
export async function applyLinkedMusic(bannerHead: string): Promise<string> {
  // Drop the previous song first so linking never leaves stale audio mid-load.
  // (clearLoadedMusic sets skip; successful loadMusic clears it.)
  await clearLoadedMusic();
  const epoch = player.musicEpoch;
  const chart = useChart.getState();
  const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
  const music = await loadLinkedMusic(wanted);
  if (player.musicEpoch !== epoch) {
    return `${bannerHead} Song cleared.`;
  }
  if (music) {
    await player.ensure();
    if (player.musicEpoch !== epoch) return `${bannerHead} Song cleared.`;
    await player.loadMusic(music);
    if (player.musicEpoch !== epoch || !player.musicName) {
      return `${bannerHead} Song cleared.`;
    }
    setSkipBootMusic(false);
    chart.setSongName(music.name);
    return `${bannerHead} Song ready: ${music.name}.`;
  }
  return (
    `${bannerHead} No music in folder` +
    (wanted ? ` (expected ${wanted})` : "") +
    " — drop an audio file."
  );
}

export async function bootMusic(): Promise<void> {
  try {
    if (shouldSkipBootMusic()) return;
    // Capture epoch so a New (or clear) during async folder/IDB fetch cannot reinstall the old track.
    const epoch = player.musicEpoch;
    const chart = useChart.getState();
    const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
    const fromFolder = await loadLinkedMusic(wanted);
    if (player.musicEpoch !== epoch || shouldSkipBootMusic()) return;
    if (fromFolder) {
      await player.ensure();
      if (player.musicEpoch !== epoch || shouldSkipBootMusic()) return;
      await player.loadMusic(fromFolder);
      if (player.musicEpoch !== epoch || !player.musicName || shouldSkipBootMusic()) return;
      chart.setSongName(fromFolder.name);
      return;
    }
    const song = await savedSong();
    if (player.musicEpoch !== epoch || shouldSkipBootMusic()) return;
    if (!song) return;
    await player.ensure();
    if (player.musicEpoch !== epoch || shouldSkipBootMusic()) return;
    await player.loadMusic(song);
    if (player.musicEpoch !== epoch || !player.musicName || shouldSkipBootMusic()) return;
    useChart.getState().setSongName(song.name);
  } catch {
    /* ignore */
  }
}
