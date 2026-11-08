import { create } from 'zustand';
import { load, save } from '../lib/storage';
import { audioContext } from './sound';

/**
 * Lofi in the barn (Brian, 2026-11-08: "add like a background lofi music"), made live with Web Audio, no files: a mellow
 * electric piano on a four-chord loop (Fmaj7, Em7, Dm7, Cmaj7), a round bass, a lazy swung kit (kick, brushed snare,
 * hats), the odd pentatonic melody note, and vinyl crackle, all through a warm low-pass at 72 bpm. It has its own switch
 * and volume in the sound menu (the speaker button), apart from the game's sound effects.
 */
const MUSIC_KEY = 'sap:music';
const MUSIC_VOLUME_KEY = 'sap:musicVolume';
const LEVEL = 0.45; // full music volume still sits under the game's own sounds
const BPM = 72;
const BEAT = 60 / BPM;
const SWING = 0.6; // where the off-beat eighth lands, as a share of the beat

interface MusicStore { on: boolean; volume: number; toggle(): void; setVolume(v: number): void }
export const useMusic = create<MusicStore>((set, get) => ({
  on: load<boolean>(MUSIC_KEY, true),
  volume: Math.min(1, Math.max(0, load<number>(MUSIC_VOLUME_KEY, 0.6))),
  toggle() { const on = !get().on; save(MUSIC_KEY, on); set({ on }); },
  setVolume(v) { const volume = Math.min(1, Math.max(0, v)); save(MUSIC_VOLUME_KEY, volume); set({ volume }); },
}));

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
/** Four bars, a chord each: piano voicing (midi) and the bass root. */
const CHORDS: { keys: number[]; bass: number }[] = [
  { keys: [57, 60, 64, 65], bass: 41 }, // Fmaj7 (A C E F)
  { keys: [55, 59, 62, 64], bass: 40 }, // Em7 (G B D E)
  { keys: [53, 57, 60, 62], bass: 38 }, // Dm7 (F A C D)
  { keys: [55, 59, 60, 64], bass: 36 }, // Cmaj7 (G B C E)
];
const MELODY = [69, 72, 74, 76, 79, 81]; // A minor pentatonic, up high

let bus: GainNode | null = null;
let warm: BiquadFilterNode | null = null;
let noise: AudioBuffer | null = null;
let timer: number | null = null;
let nextBeat = 0;
let beat = 0;
let crackle: AudioBufferSourceNode | null = null;

function level(): number {
  const m = useMusic.getState();
  return m.on ? m.volume * LEVEL : 0;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function env(c: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

/** An electric-piano note: a sine with a soft triangle an octave up, a little detune, a slow bloom and a long tail. */
function keys(c: AudioContext, note: number, at: number, dur: number, vol: number) {
  const g = env(c, at, vol, 0.03, dur);
  for (const [type, mult, share, cents] of [['sine', 1, 1, -4], ['triangle', 2, 0.18, 5]] as const) {
    const o = c.createOscillator();
    o.type = type; o.frequency.value = midi(note) * mult; o.detune.value = cents;
    const s = c.createGain(); s.gain.value = share;
    o.connect(s).connect(g);
    o.start(at); o.stop(at + dur + 0.1);
  }
  g.connect(warm!);
}

function bass(c: AudioContext, note: number, at: number, dur: number) {
  const g = env(c, at, 0.5, 0.02, dur);
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = midi(note);
  o.connect(g).connect(warm!); o.start(at); o.stop(at + dur + 0.1);
}

function kick(c: AudioContext, at: number) {
  const g = env(c, at, 0.7, 0.005, 0.32);
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(110, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.25);
  o.connect(g).connect(warm!); o.start(at); o.stop(at + 0.4);
}

function hiss(c: AudioContext, at: number, type: BiquadFilterType, freq: number, vol: number, dur: number) {
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
  const g = env(c, at, vol, 0.004, dur);
  src.connect(f).connect(g).connect(warm!);
  src.start(at, Math.random()); src.stop(at + dur + 0.05);
}

/** One beat's worth of notes, scheduled ahead on the audio clock. */
function scheduleBeat(c: AudioContext, at: number, n: number) {
  const bar = Math.floor(n / 4) % CHORDS.length, b = n % 4;
  const chord = CHORDS[bar];
  const off = at + BEAT * SWING;
  // Piano: the chord rolled on beat 1, a softer stab on the "and" of 3.
  if (b === 0) chord.keys.forEach((k, i) => keys(c, k, at + i * 0.025 + Math.random() * 0.01, BEAT * 3.6, 0.07));
  if (b === 2) chord.keys.slice(1).forEach((k, i) => keys(c, k, off + i * 0.02, BEAT * 1.4, 0.04));
  // Bass: the root on 1, again on the "and" of 3.
  if (b === 0) bass(c, chord.bass, at, BEAT * 1.6);
  if (b === 2) bass(c, chord.bass, off, BEAT * 0.9);
  // Drums: kick on 1 and the "and" of 2, a brushed snare on 2 and 4 laid back, hats on the eighths.
  if (b === 0) kick(c, at);
  if (b === 1) kick(c, off);
  if (b === 1 || b === 3) hiss(c, at + 0.025, 'bandpass', 1800, 0.22, 0.18);
  hiss(c, at, 'highpass', 7000, 0.05 + Math.random() * 0.03, 0.05);
  hiss(c, off, 'highpass', 7000, 0.03 + Math.random() * 0.03, 0.04);
  // Now and then a high note from the pentatonic.
  if (Math.random() < 0.28) keys(c, MELODY[Math.floor(Math.random() * MELODY.length)], at + (Math.random() < 0.5 ? 0 : BEAT * SWING), BEAT * 2, 0.035);
}

function startCrackle(c: AudioContext) {
  const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.6 : 0);
  crackle = c.createBufferSource(); crackle.buffer = buf; crackle.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
  const g = c.createGain(); g.gain.value = 0.5;
  crackle.connect(f).connect(g).connect(bus!);
  crackle.start();
}

function tick() {
  const c = audioContext();
  if (!c || !bus) return;
  const want = level();
  bus.gain.setTargetAtTime(want, c.currentTime, 0.4);
  if (want === 0) { nextBeat = c.currentTime + 0.1; return; } // silent: hold the groove, schedule nothing
  if (nextBeat < c.currentTime) nextBeat = c.currentTime + 0.1;
  while (nextBeat < c.currentTime + 0.4) { scheduleBeat(c, nextBeat, beat++); nextBeat += BEAT; }
}

/** Starts the loop once audio is unlocked (the first tap or key press); safe to call again. */
export function startMusic(): void {
  const c = audioContext();
  if (!c || timer !== null) return;
  bus = c.createGain(); bus.gain.value = 0;
  warm = c.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 2400; warm.Q.value = 0.4;
  // A slow wobble on the filter, like a worn tape.
  const lfo = c.createOscillator(); lfo.frequency.value = 0.17;
  const depth = c.createGain(); depth.gain.value = 260;
  lfo.connect(depth).connect(warm.frequency); lfo.start();
  warm.connect(bus).connect(c.destination);
  startCrackle(c);
  nextBeat = c.currentTime + 0.3;
  timer = window.setInterval(tick, 100);
}
