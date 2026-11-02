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
  const chart = useChart.getState();
  const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
  const music = await loadLinkedMusic(wanted);
  if (music) {
    await player.ensure();
    await player.loadMusic(music);
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
    const chart = useChart.getState();
    const wanted = musicFileName(chart.wavNames ?? {}, chart.notes);
    const fromFolder = await loadLinkedMusic(wanted);
    if (fromFolder) {
      await player.ensure();
      await player.loadMusic(fromFolder);
      chart.setSongName(fromFolder.name);
      return;
    }
    const song = await savedSong();
    if (!song) return;
    await player.ensure();
    await player.loadMusic(song);
    useChart.getState().setSongName(song.name);
  } catch {
    /* ignore */
  }
}
