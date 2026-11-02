import { musicFileName } from "./bms";
import { player } from "./player";
import { clearSong, savedSong } from "./songStore";
import { loadLinkedMusic } from "./chartFolder";
import { useChart } from "./store";

/** Stop playback and drop in-memory + IndexedDB song so nothing old can keep playing. */
export async function clearLoadedMusic(): Promise<void> {
  player.clearMusic();
  await clearSong().catch(() => undefined);
  useChart.getState().setSongName("");
}

/** Prefer folder music; always replace any previous track. */
export async function applyLinkedMusic(bannerHead: string): Promise<string> {
  // Drop the previous song first so linking never leaves stale audio mid-load.
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
    // Capture epoch so a New (or clear) during async folder/IDB fetch cannot reinstall the old track.
    const epoch = player.musicEpoch;
    const chart = useChart.getState();
    const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
    const fromFolder = await loadLinkedMusic(wanted);
    if (player.musicEpoch !== epoch) return;
    if (fromFolder) {
      await player.ensure();
      if (player.musicEpoch !== epoch) return;
      await player.loadMusic(fromFolder);
      if (player.musicEpoch !== epoch || !player.musicName) return;
      chart.setSongName(fromFolder.name);
      return;
    }
    const song = await savedSong();
    if (player.musicEpoch !== epoch) return;
    if (!song) return;
    await player.ensure();
    if (player.musicEpoch !== epoch) return;
    await player.loadMusic(song);
    if (player.musicEpoch !== epoch || !player.musicName) return;
    useChart.getState().setSongName(song.name);
  } catch {
    /* ignore */
  }
}
