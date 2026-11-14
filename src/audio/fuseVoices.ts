/**
 * The bomb's fuse sounds: what the fuse plays on each whole second of a turn. A shop cosmetic (src/skin/shop/catalog.ts,
 * TICK_VOICE): a voice changes what a second sounds like and never when it sounds.
 *
 * Each one is a sound of its own, made live with Web Audio (Brian, 2026-11-13: "make the sounds actually useable, i dont
 * see them working both in the preview and in game"). They were all the same short beep at a slightly different pitch,
 * and the calm seconds were quieter than the music, so wearing one changed nothing a player could hear. Now a wood
 * block knocks tick and tock, a cowbell clanks, sleigh bells jingle, an owl hoots, a music box plays a tune a note a
 * second. Every calm second is louder than the music; the last three are louder still, higher, and doubled.
 *
 * Nothing here is made from noise: tones only, so nothing hisses (Brian, 2026-11-08, of the music: "why is there static").
 * The ice chime, the bomb's own beep that everyone starts with, is exactly as it was.
 */
export type TickVoice = 'chime' | 'square' | 'wood' | 'lullaby' | 'cowbell' | 'sleigh' | 'owl' | 'musicbox';
export const TICK_VOICES: readonly TickVoice[] = ['chime', 'square', 'wood', 'lullaby', 'cowbell', 'sleigh', 'owl', 'musicbox'];

/** One second of a turn: when it sounds (audio time), the whole seconds left, how far through the turn (0 to 1), and which second of the turn it is, counting from 0. */
export interface Beat { at: number; left: number; through: number; step: number }
/** Everything a voice starts is handed to this, with when it starts, so the clock can stop it. */
export type Keep = (source: AudioScheduledSourceNode, gain: GainNode, at: number) => void;

/** One tone of a beat. Times are in seconds; `delay` is after the beat. */
interface Tone {
  type?: OscillatorType;
  freq: number;
  /** Slide to this pitch over `glide` seconds (the whole tone if not given). */
  to?: number; glide?: number;
  vol: number;
  delay?: number;
  /** Rise, stay, fall. `soft` rises evenly (a breath: the owl); otherwise the rise is a strike. */
  attack?: number; hold?: number; dur: number; soft?: boolean;
  /** A struck thing that rings: fall to this share of `vol` over `dur`, then die away over this many seconds more. */
  ring?: [share: number, seconds: number];
}
interface Sound { tones: Tone[]; filter?: { type: BiquadFilterType; freq: number; q: number } }

/** The last three seconds: every voice is louder, higher and doubled there. */
const finale = (b: Beat) => b.left <= 3;
/** How many semitones the last three seconds climb: 0, 2, 4. */
const climb = (b: Beat, semitones = 2) => 2 ** (((3 - b.left) * semitones) / 12);

// Notes, in Hz.
const C6 = 1046.5, D6 = 1174.66, E6 = 1318.51, F6 = 1396.91, G6 = 1567.98, A6 = 1760, B6 = 1975.53, C7 = 2093;
/** The music box's tune, a note a second: Brahms's lullaby (1868), a turn starting it again from the top. */
export const MUSIC_BOX_TUNE: readonly number[] = [E6, E6, G6, E6, E6, G6, E6, G6, C7, B6, A6, A6, G6, D6, E6, F6, D6, D6, E6, F6, D6, F6, B6, A6, G6, B6, C7];
/** The lullaby's rocking pairs: a note and the one it falls to. */
const ROCK: readonly [number, number][] = [[C6, 783.99], [880, 659.26], [783.99, 587.33], [880, 659.26]];
/** A strap of sleigh bells: five small bells, none in tune with another. */
const BELLS = [2350, 3136, 3951, 4699, 5588];

/** A knock on a wood block: a short low tone that drops as it lands, a higher one over it, a click on top. */
const knock = (f: number, v: number, delay = 0): Tone[] => [
  { freq: f * 1.3, to: f, glide: 0.015, vol: v, delay, attack: 0.002, dur: 0.085 },
  { freq: f * 2.7, vol: v * 0.45, delay, attack: 0.002, dur: 0.035 },
  { type: 'triangle', freq: f * 5.1, vol: v * 0.25, delay, attack: 0.001, dur: 0.012 },
];
/** A small soft bell, for the lullaby. */
const bell = (f: number, v: number, delay = 0): Tone[] => [
  { freq: f, vol: v, delay, attack: 0.012, dur: 0.55 },
  { freq: f * 2, vol: v * 0.22, delay, attack: 0.012, dur: 0.28 },
  { freq: f * 4.02, vol: v * 0.05, delay, attack: 0.005, dur: 0.08 },
];
/** A cowbell struck once: two square tones that are not in tune (the bell's two sides), a clank that falls fast and then rings. */
const clank = (k: number, v: number, delay = 0): Tone[] => [
  { type: 'square', freq: 587 * k, vol: v, delay, attack: 0.002, dur: 0.05, ring: [0.3, 0.3] },
  { type: 'square', freq: 845 * k, vol: v * 0.8, delay, attack: 0.002, dur: 0.05, ring: [0.3, 0.3] },
  { freq: 1420 * k, vol: v * 0.3, delay, attack: 0.002, dur: 0.12 },
];
/** The strap shaken once: the five bells struck three times in a row, a little differently each time. */
const jingle = (k: number, v: number, delay: number, seed: number): Tone[] =>
  BELLS.map((f, i) => ({ freq: f * k * (1 + ((((seed + i) * 7) % 5) - 2) * 0.004), vol: v * [1, 0.8, 0.9, 0.6, 0.5][i], delay: delay + i * 0.004, attack: 0.002, dur: 0.07 + ((i + seed) % 3) * 0.035 }));
const shake = (k: number, v: number, delay: number, seed: number): Tone[] =>
  [...jingle(k, v, delay, seed), ...jingle(k * 1.03, v * 0.6, delay + 0.06, seed + 1), ...jingle(k * 0.985, v * 0.8, delay + 0.125, seed + 2)];
/** An owl's hoo: a soft breath in, a held note that sinks, its second and third harmonics so a phone's small speaker carries it. */
const hoot = (f: number, v: number, delay: number, hold: number): Tone[] => [
  { type: 'triangle', freq: f * 1.03, to: f * 0.86, vol: v, delay, attack: 0.045, hold, dur: 0.16, soft: true },
  { freq: f * 2.06, to: f * 1.72, vol: v * 0.3, delay, attack: 0.045, hold, dur: 0.12, soft: true },
  { freq: f * 3.09, to: f * 2.58, vol: v * 0.1, delay, attack: 0.045, hold: hold * 0.7, dur: 0.08, soft: true },
];
/** A music box's tine plucked: a clear note that rings on, its octave and twelfth, the tick of the pin leaving it. */
const pluck = (f: number, v: number, delay = 0): Tone[] => [
  { freq: f, vol: v, delay, attack: 0.002, dur: 0.85 },
  { freq: f * 2, vol: v * 0.35, delay, attack: 0.002, dur: 0.5 },
  { freq: f * 3, vol: v * 0.12, delay, attack: 0.002, dur: 0.25 },
  { freq: f * 5.4, vol: v * 0.1, delay, attack: 0.001, dur: 0.03 },
];

const VOICES: Record<TickVoice, (b: Beat) => Sound> = {
  // Ice chime: the bright beep the bomb always had. Not changed.
  chime: (b) => {
    const last = finale(b), freq = last ? 1100 + (3 - b.left) * 180 : 520 + b.through * 480, dur = (last ? 0.22 : 0.12) - 0.005;
    const tones: Tone[] = [{ type: last ? 'square' : 'triangle', freq, vol: last ? 0.9 : 0.08 + b.through * 0.22, attack: 0.005, dur }];
    if (last) tones.push({ type: 'sawtooth', freq: freq * 1.5, vol: 0.5, attack: 0.005, dur });
    return { tones };
  },
  // Tin toy: a wind-up toy's two-note chirp, then a run of four as it winds down.
  square: (b) => {
    if (!finale(b)) {
      const v = 0.32 + b.through * 0.1;
      return { tones: [{ type: 'square', freq: 587.33, vol: v, dur: 0.06 }, { type: 'square', freq: 880, vol: v, delay: 0.07, dur: 0.09 }] };
    }
    const f = 783.99 * climb(b);
    return { tones: [1, 1.26, 1.5, 2].map((k, i) => ({ type: 'square' as const, freq: f * k, vol: 0.62, delay: i * 0.055, dur: i === 3 ? 0.14 : 0.05 })) };
  },
  // Wood block: tick, tock, like the clock in the barn; then two quick knocks a second.
  wood: (b) => {
    if (!finale(b)) return { tones: knock(b.step % 2 ? 740 : 880, 0.38 + b.through * 0.12) };
    const f = 1050 + (3 - b.left) * 120;
    return { tones: [...knock(f, 0.6), ...knock(f, 0.5, 0.13)] };
  },
  // Lullaby: a nursery mobile, a note and the one it falls to; then three rising ones.
  lullaby: (b) => {
    if (!finale(b)) {
      const [hi, lo] = ROCK[b.step % ROCK.length], v = 0.32 + b.through * 0.1;
      return { tones: [...bell(hi, v), ...bell(lo, v * 0.85, 0.27)] };
    }
    const k = climb(b);
    return { tones: [C6, E6, G6].flatMap((f, i) => bell(f * k, 0.55, i * 0.12)) };
  },
  // Cowbell: one clank off the dairy cow's collar; then two.
  cowbell: (b) => {
    const filter = { type: 'bandpass' as const, freq: 1000, q: 0.9 };
    if (!finale(b)) return { tones: clank(1, 0.25 + b.through * 0.08), filter };
    const k = climb(b, 1);
    return { tones: [...clank(k, 0.5), ...clank(k, 0.42, 0.15)], filter };
  },
  // Sleigh bells: the strap shaken once; then twice.
  sleigh: (b) => {
    if (!finale(b)) return { tones: shake(1, 0.14 + b.through * 0.05, 0, b.step) };
    const k = climb(b, 1);
    return { tones: [...shake(k, 0.27, 0, b.step), ...shake(k, 0.22, 0.26, b.step + 3)] };
  },
  // Barn owl: hoo, and a lower hoo in answer; then hoo-HOO.
  owl: (b) => {
    if (!finale(b)) return { tones: hoot(b.step % 2 ? 349.23 : 392, 0.42 + b.through * 0.1, 0, 0.16) };
    const f = 440 * climb(b);
    return { tones: [...hoot(f, 0.45, 0, 0.05), ...hoot(f * 1.12, 0.62, 0.2, 0.16)] };
  },
  // Music box: the tune, a note a second; then each note with a run up from it.
  musicbox: (b) => {
    const f = MUSIC_BOX_TUNE[b.step % MUSIC_BOX_TUNE.length];
    if (!finale(b)) return { tones: pluck(f, 0.34 + b.through * 0.1) };
    return { tones: [...pluck(f, 0.6), ...pluck(f * 1.5, 0.3, 0.14), ...pluck(f * 2, 0.3, 0.28)] };
  },
};

/** How long one tone lasts, from the beat to silence. */
const lasts = (t: Tone) => (t.delay ?? 0) + (t.attack ?? 0.004) + (t.hold ?? 0) + t.dur + (t.ring?.[1] ?? 0);
/** What a voice plays on one beat, as plain numbers: for the tests, and for anything that wants to know how long a beat rings. */
export function fuseTones(voice: TickVoice, b: Beat): { type: OscillatorType; freq: number; vol: number; delay: number; lasts: number }[] {
  return VOICES[voice](b).tones.map((t) => ({ type: t.type ?? 'sine', freq: t.freq, vol: t.vol, delay: t.delay ?? 0, lasts: lasts(t) }));
}

/** Schedules one beat of a fuse voice into `dest`. `gain` scales its loudness (the dream's alarm is played low). */
export function fuseBeat(c: BaseAudioContext, dest: AudioNode, voice: TickVoice, b: Beat, keep: Keep, gain = 1): void {
  const { tones, filter } = VOICES[voice](b);
  let out = dest;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q;
    f.connect(dest);
    out = f;
  }
  for (const t of tones) {
    const t0 = b.at + (t.delay ?? 0), attack = t.attack ?? 0.004, peak = Math.max(0.0002, t.vol * gain);
    const held = t0 + attack + (t.hold ?? 0), end = b.at + lasts(t);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, t0);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + (t.glide ?? end - t0));
    g.gain.setValueAtTime(0.0001, t0);
    if (t.soft) g.gain.linearRampToValueAtTime(peak, t0 + attack); else g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    if (t.hold) g.gain.setValueAtTime(peak, held);
    if (t.ring) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * t.ring[0]), held + t.dur);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(end + 0.03);
    keep(osc, g, t0);
  }
}
