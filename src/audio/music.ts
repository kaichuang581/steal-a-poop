import { create } from 'zustand';
import { load, save } from '../lib/storage';
import type { Kit } from './musicKit';
import { musicScene } from './scene';
import type { Heat, MusicScene } from './scene';
import { SONGS } from './songs';
import type { Song } from './songs';
import { audioContext, musicDuck } from './sound';

/**
 * The game's music (Brian, 2026-11-08: "add like a background lofi music"; 2026-11-13: "the calm lofi should only be in
 * the start screen ... ensure each gamemode and when u switch onto something else the music changes"), made live with
 * Web Audio, no files. Each place a player can be has a song of its own (songs.ts), played on the band in musicKit.ts;
 * this file is the player: it reads where the player is (scene.ts), schedules the song a bar at a time on the audio
 * clock, and crossfades to another song when the player goes somewhere else. Nothing is made from noise, so nothing
 * hisses (Brian, 2026-11-08: "why is there static noise in the music"). It has its own switch and volume in the sound
 * menu (the speaker button), apart from the game's sound effects.
 */
const MUSIC_KEY = 'sap:music';
const MUSIC_VOLUME_KEY = 'sap:musicVolume';
const LEVEL = 0.45; // full music volume still sits under the game's own sounds

interface MusicStore { on: boolean; volume: number; toggle(): void; setVolume(v: number): void }
export const useMusic = create<MusicStore>((set, get) => ({
  on: load<boolean>(MUSIC_KEY, true),
  volume: Math.min(1, Math.max(0, load<number>(MUSIC_VOLUME_KEY, 0.6))),
  toggle() { const on = !get().on; save(MUSIC_KEY, on); set({ on }); },
  setVolume(v) { const volume = Math.min(1, Math.max(0, v)); save(MUSIC_VOLUME_KEY, volume); set({ volume }); },
}));

/** A seeded random number: the same song comes out the same every time it starts. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One song set up to play: its band's stage (the kit), its fader, and what to stop when it is done with. */
interface Stage { song: Song; kit: Kit; fader: GainNode; delay: DelayNode; lfos: OscillatorNode[] }

/**
 * Builds a song's stage on `c`, playing into `dest`: the mix (through the song's warm low-pass if it has one), the bus
 * that ducks under the kick, a low-pass for basses and a gentler one for chords, a little width to either side, an
 * echo timed to the song, and a slow tape wobble.
 */
function stage(c: BaseAudioContext, dest: AudioNode, song: Song, heat: Heat): Stage {
  const fader = c.createGain(), level = c.createGain(), lfos: OscillatorNode[] = [];
  level.gain.value = song.level;
  level.connect(fader).connect(dest);
  let out: AudioNode = level;
  const lfo = (rate: number, depth: number): GainNode => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); o.start();
    lfos.push(o);
    return g;
  };
  if (song.warm) {
    const warm = c.createBiquadFilter();
    warm.type = 'lowpass'; warm.frequency.value = song.warm; warm.Q.value = 0.4;
    // A slow wobble on the filter, like a worn tape.
    lfo(0.17, song.warm * 0.1).connect(warm.frequency);
    warm.connect(level);
    out = warm;
  }
  const filter = (hz: number, to: AudioNode): BiquadFilterNode => {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = hz; f.Q.value = 0.5;
    f.connect(to);
    return f;
  };
  const side = (pan: number): AudioNode => {
    if (typeof c.createStereoPanner !== 'function') return out;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    p.connect(out);
    return p;
  };
  const pump = c.createGain();
  pump.connect(out);
  // The echo: what goes in comes back after a few beats, darker each time round.
  const delay = c.createDelay(2), back = c.createGain(), dark = filter(2200, delay), wet = c.createGain();
  delay.delayTime.value = (60 / song.bpm(heat)) * song.echo.beats;
  back.gain.value = song.echo.back;
  wet.gain.value = 0.5;
  delay.connect(back).connect(dark);
  delay.connect(wet).connect(side(-0.2));
  const kit: Kit = {
    c, out, air: level, pump, low: filter(900, pump), soft: filter(3400, pump), echo: delay, left: side(-0.35), right: side(0.35),
    wow: lfo(0.31, 5), rand: seeded(song.name.length * 7919 + song.beats),
  };
  return { song, kit, fader, delay, lfos };
}

/** Schedules one bar of a stage's song starting at `at`; returns how long the bar is. */
function playBar(st: Stage, at: number, bar: number, heat: Heat): number {
  const { song } = st, beat = 60 / song.bpm(heat);
  // An off-beat eighth falls late by the song's swing; everything between moves with it.
  const t = (b: number) => {
    const whole = Math.floor(b), f = b - whole;
    return at + (whole + (f <= 0.5 ? (f / 0.5) * song.swing : song.swing + ((f - 0.5) / 0.5) * (1 - song.swing))) * beat;
  };
  st.delay.delayTime.setValueAtTime(beat * song.echo.beats, at);
  song.bar(st.kit, t, bar, heat, beat);
  return beat * song.beats;
}

/**
 * Plays `bars` bars of a scene's song into `dest` from time 0, all at once: for looking at a song without the game
 * (an OfflineAudioContext, in the tools and the tests). Returns how many seconds that is.
 */
export function renderScene(c: BaseAudioContext, dest: AudioNode, scene: MusicScene, bars: number, heat: Heat = 0, from = 0): number {
  const st = stage(c, dest, SONGS[scene], heat);
  let at = 0.05;
  for (let b = 0; b < bars; b++) at += playBar(st, at, from + b, heat);
  return at;
}

let master: GainNode | null = null;
let timer: number | null = null;
/** The song playing now: its stage, which scene it is, when its next bar starts and which bar that is. */
let now: (Stage & { scene: MusicScene; next: number; bar: number }) | null = null;
/**
 * Where the start screen's song and the Trading Post's were left, in bars: a player flips between those two all the
 * time, and each picks up where it was instead of playing its opening again. Every other song starts from its top.
 */
const left: Partial<Record<MusicScene, number>> = {};

/** The music's level now: its own volume, stepped back while a fuse sound is being sampled in the Trading Post. */
function level(): number {
  const m = useMusic.getState();
  return m.on ? m.volume * LEVEL * musicDuck() : 0;
}

/** Fades a song out and takes its stage down once it is silent. */
function retire(c: AudioContext, st: Stage): void {
  st.fader.gain.cancelScheduledValues(c.currentTime);
  st.fader.gain.setTargetAtTime(0, c.currentTime, 0.18);
  window.setTimeout(() => {
    for (const o of st.lfos) { try { o.stop(); } catch { /* already stopped */ } }
    st.fader.disconnect();
  }, 2500);
}

function tick() {
  const c = audioContext();
  if (!c || !master) return;
  const want = level(), { scene, heat } = musicScene();
  // Stepping back for a sample is quick; coming back up, and every other change, is slow.
  master.gain.setTargetAtTime(want, c.currentTime, musicDuck() < 1 ? 0.06 : 0.4);
  // Somewhere else: the old song fades out as the new one comes in from its first bar.
  if (!now || now.scene !== scene) {
    if (now) { retire(c, now); left[now.scene] = now.bar; }
    const st = stage(c, master, SONGS[scene], heat);
    st.fader.gain.setValueAtTime(0, c.currentTime);
    st.fader.gain.linearRampToValueAtTime(1, c.currentTime + 0.5);
    now = { ...st, scene, next: c.currentTime + 0.12, bar: scene === 'home' || scene === 'shop' ? left[scene] ?? 0 : 0 };
  }
  if (want === 0) { now.next = c.currentTime + 0.1; return; } // silent: hold the place, schedule nothing
  if (now.next < c.currentTime) now.next = c.currentTime + 0.1;
  // A bar is scheduled whole, a moment before it starts.
  while (now.next < c.currentTime + 0.3) now.next += playBar(now, now.next, now.bar++, heat);
}

/** Which scene's song is playing and the next bar it will play, or null before the music has started. */
export function playhead(): { scene: MusicScene; bar: number } | null {
  return now && { scene: now.scene, bar: now.bar };
}

/** Which song is playing, for the sound menu. */
export function nowPlaying(): string {
  return SONGS[musicScene().scene].name;
}

/** Starts the music once audio is unlocked (the first tap or key press); safe to call again. */
export function startMusic(): void {
  const c = audioContext();
  if (!c || timer !== null) return;
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  timer = window.setInterval(tick, 100);
}
