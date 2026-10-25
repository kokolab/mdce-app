import { soundFor } from "./catalog";
import type { ChartNote } from "./bms";
import { secondsAt, tickAt, type StopPoint, type TempoPoint } from "./timing";

type Hit = { id: string; time: number; key: string };

function holdPitch(audio: HTMLAudioElement) {
  audio.preservesPitch = true;
  const extra = audio as HTMLAudioElement & { webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };
  extra.webkitPreservesPitch = true;
  extra.mozPreservesPitch = true;
}

export class Player {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private music: AudioBuffer | null = null;
  private song: HTMLAudioElement | null = null;
  private songUrl = "";
  musicName = "";
  bgmVolume = 0.25;
  sfxVolume = 0.25;
  rate = 1;
  /** Seconds added to the chart's music mark. Positive starts the file later. */
  musicOffset = 0;
  private sfx = new Set<AudioBufferSourceNode>();
  private musicNode: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private fired = new Set<string>();
  playing = false;
  private originCtx = 0;
  private originSong = 0;
  private look = 0.14;

  async ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  async loadUsed(notes: ChartNote[]) {
    const ctx = await this.ensure();
    const jobs: Promise<void>[] = [];
    for (const note of notes) {
      const url = soundFor(note.key);
      if (!url || this.buffers.has(note.key)) continue;
      this.buffers.set(note.key, null as unknown as AudioBuffer);
      jobs.push(
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((raw) => ctx.decodeAudioData(raw.slice(0)))
          .then((buffer) => {
            this.buffers.set(note.key, buffer);
          })
          .catch(() => {
            this.buffers.delete(note.key);
          }),
      );
    }
    await Promise.all(jobs);
  }

  setRate(rate: number) {
    const next = Math.min(2, Math.max(0.25, rate));
    if (Math.abs(next - this.rate) < 0.0001) return;
    const wasNormal = Math.abs(this.rate - 1) < 0.001;
    if (this.playing && this.ctx) {
      this.originSong = this.songSeconds();
      this.originCtx = this.ctx.currentTime;
    }
    this.rate = next;
    const nowNormal = Math.abs(next - 1) < 0.001;
    if (this.playing && this.musicArmed && wasNormal !== nowNormal) {
      this.stopMusic();
      this.syncMusic(this.musicOffset);
    } else if (this.song && !nowNormal) {
      holdPitch(this.song);
      this.song.playbackRate = next;
    }
    if (this.playing) this.reschedule();
  }

  /** Drop pending note hits so they are scheduled again against the current tempo. */
  reschedule() {
    this.fired.clear();
    for (const source of this.sfx) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sfx.clear();
  }

  setMix(bgm: number, sfx: number) {
    this.bgmVolume = bgm;
    this.sfxVolume = sfx;
    if (this.song) this.song.volume = bgm;
    if (this.musicGain && this.ctx) this.musicGain.gain.setValueAtTime(bgm, this.ctx.currentTime);
  }

  async loadMusic(file: File) {
    const ctx = await this.ensure();
    if (this.songUrl) URL.revokeObjectURL(this.songUrl);
    this.songUrl = URL.createObjectURL(file);
    if (!this.song) this.song = new Audio();
    holdPitch(this.song);
    this.song.preload = "auto";
    this.song.src = this.songUrl;
    this.song.playbackRate = this.rate;
    this.song.volume = this.bgmVolume;
    const raw = await file.arrayBuffer();
    this.music = await ctx.decodeAudioData(raw.slice(0));
    this.musicName = file.name;
  }

  duration() {
    return this.music?.duration ?? 0;
  }

  peaks(buckets = 240): number[] {
    if (!this.music) return [];
    const data = this.music.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / buckets));
    const out: number[] = [];
    for (let index = 0; index < buckets; index++) {
      let peak = 0;
      const start = index * size;
      for (let offset = 0; offset < size; offset += 64) {
        peak = Math.max(peak, Math.abs(data[start + offset] ?? 0));
      }
      out.push(peak);
    }
    return out;
  }

  songSeconds(): number {
    if (!this.playing || !this.ctx) return this.originSong;
    return this.originSong + (this.ctx.currentTime - this.originCtx) * this.rate;
  }

  heardSeconds(): number {
    const ctx = this.ctx;
    if (!ctx) return this.songSeconds();
    const reported = ctx.outputLatency;
    const latency = reported > 0 && reported < 0.12 ? reported : ctx.baseLatency || 0;
    return Math.max(0, this.songSeconds() - latency);
  }

  play(fromSeconds: number) {
    if (!this.ctx) return;
    this.stopSources();
    this.fired.clear();
    this.playing = true;
    this.originSong = Math.max(0, fromSeconds);
    this.originCtx = this.ctx.currentTime;
  }

  pause() {
    if (!this.ctx || !this.playing) return;
    this.originSong = this.songSeconds();
    this.playing = false;
    this.stopSources();
  }

  stop() {
    this.playing = false;
    this.originSong = 0;
    this.stopSources();
    this.fired.clear();
  }

  rearm() {
    if (!this.playing || !this.ctx) return;
    const at = this.songSeconds();
    this.stopSources();
    this.playing = true;
    this.originSong = at;
    this.originCtx = this.ctx.currentTime;
    this.fired.clear();
  }

  seek(seconds: number) {
    const was = this.playing;
    this.stopSources();
    this.fired.clear();
    this.originSong = Math.max(0, seconds);
    this.playing = was;
    if (was && this.ctx) this.originCtx = this.ctx.currentTime;
  }

  pump(notes: ChartNote[], points: TempoPoint[], stops: StopPoint[] = []) {
    if (!this.playing || !this.ctx) return this.originSong;
    const now = this.songSeconds();
    const horizon = now + this.look * this.rate;
    // The audio file is already aligned so file time equals chart time.
    // The MUSIC note only tells uBMplay which sample to load; it is not an extra delay.
    this.syncMusic(this.musicOffset);
    const geminiHeard = new Set<string>();
    for (const note of notes) {
      if (note.lane === "bpm" || note.lane === "bgm" || note.key === "10") continue;
      if (!soundFor(note.key) || this.fired.has(note.id)) continue;
      const time = secondsAt(note.tick, points, stops);
      if (time < now - 0.02) {
        this.fired.add(note.id);
        continue;
      }
      if (time > horizon) continue;
      if (note.key === "0E") {
        const column = note.lane === "air2" || note.lane === "gnd2" ? "2" : "1";
        const pair = `${column}:${note.tick}`;
        if (geminiHeard.has(pair)) {
          this.fired.add(note.id);
          continue;
        }
        geminiHeard.add(pair);
      }
      this.fired.add(note.id);
      this.blip(note.key, Math.max(0, (time - now) / this.rate), this.sfxVolume);
    }
    return now;
  }

  tickFor(points: TempoPoint[], stops: StopPoint[] = []): number {
    return tickAt(this.heardSeconds(), points, stops);
  }

  private musicArmed = false;

  syncMusic(musicStart: number) {
    if (!this.playing || !this.ctx || !this.music || this.musicArmed) return;
    const now = this.songSeconds();
    if (now + this.look * this.rate < musicStart) return;
    const offset = Math.max(0, now - musicStart);
    if (offset >= this.music.duration) {
      this.musicArmed = true;
      return;
    }
    if (Math.abs(this.rate - 1) < 0.001) this.armBuffer(offset, Math.max(0, musicStart - now));
    else this.armElement(offset);
    this.musicArmed = true;
  }

  private armBuffer(offset: number, delay: number) {
    if (!this.ctx || !this.music) return;
    if (this.song) this.song.pause();
    const source = this.ctx.createBufferSource();
    source.buffer = this.music;
    source.playbackRate.value = 1;
    const gain = this.ctx.createGain();
    gain.gain.value = this.bgmVolume;
    this.musicGain = gain;
    source.connect(gain).connect(this.ctx.destination);
    source.start(this.ctx.currentTime + delay, offset);
    this.musicNode = source;
    source.onended = () => {
      if (this.musicNode === source) this.musicNode = null;
    };
  }

  private armElement(offset: number) {
    if (!this.song) this.song = new Audio();
    const song = this.song;
    if (this.musicNode) {
      try {
        this.musicNode.stop();
      } catch {
        /* already stopped */
      }
      this.musicNode = null;
      this.musicGain = null;
    }
    holdPitch(song);
    song.playbackRate = this.rate;
    song.volume = this.bgmVolume;
    const start = () => {
      if (!this.playing || song !== this.song) return;
      try {
        song.currentTime = offset;
      } catch {
        /* metadata not ready */
      }
      void song.play().catch(() => undefined);
    };
    if (song.readyState >= 1) start();
    else song.addEventListener("loadedmetadata", start, { once: true });
  }

  private stopMusic() {
    if (this.musicNode) {
      try {
        this.musicNode.stop();
      } catch {
        /* already stopped */
      }
    }
    this.musicNode = null;
    this.musicGain = null;
    if (this.song) this.song.pause();
    this.musicArmed = false;
  }

  private blip(key: string, delay: number, volume: number) {
    const buffer = this.buffers.get(key);
    if (!buffer || !this.ctx || buffer.length == null) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.ctx.destination);
    source.start(this.ctx.currentTime + delay);
    this.sfx.add(source);
    source.onended = () => this.sfx.delete(source);
  }

  private stopSources() {
    this.stopMusic();
    for (const source of this.sfx) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sfx.clear();
  }
}

export const player = new Player();
