/**
 * The band: every instrument the game's music is played on, made live with Web Audio from plain oscillators. No audio
 * files, and no noise anywhere (Brian, 2026-11-08: "why is there static noise in the music"): the drums are tones too,
 * a kick that drops in pitch, a knock for a snare, a high blip for a hat.
 *
 * A `Kit` is one song's stage: its context, where its sound goes, and a few shared sends (an echo, a low-pass for the
 * bass, a bus that ducks under the kick). An instrument is a function that schedules one note on the audio clock.
 */
export interface Kit {
  c: BaseAudioContext;
  /** The song's own mix: everything ends up here. `air` goes round the song's warm low-pass, for a hat or a sparkle that should stay bright. */
  out: AudioNode; air: AudioNode;
  /** Sends into `out`: `pump` ducks under each kick, `low` is a low-pass for basses, `soft` a gentler one for chords and arps, `echo` repeats what it is given, `left` and `right` sit to either side. */
  pump: GainNode; low: AudioNode; soft: AudioNode; echo: AudioNode; left: AudioNode; right: AudioNode;
  /** A slow wobble in pitch, like a worn tape, for whatever asks for it. */
  wow: AudioNode;
  /** The song's own random numbers: the same song comes out the same. */
  rand: () => number;
}

/** A midi note's pitch in Hz. */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C4" is 60, "F#3" 54, "Bb2" 46. */
export function n(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
/** Several notes at once: "E3 G3 B3 D4". */
export const notes = (names: string): number[] => names.split(' ').map(n);

interface ToneOpts {
  at: number; dur: number; vol: number;
  type?: OscillatorType;
  /** pluck: struck, then dies away over `dur`. hold: swells in, stays, lets go at the end. */
  shape?: 'pluck' | 'hold';
  attack?: number; release?: number;
  detune?: number;
  /** Start this many times the pitch and fall to it over `fall` seconds (a drum). */
  from?: number; fall?: number;
  /** A singer's waver, in cents, starting a moment into the note. */
  vibrato?: number;
  wow?: boolean;
  to?: AudioNode;
}

/** One oscillator with an envelope: the one thing every instrument is built from. */
export function tone(k: Kit, freq: number, o: ToneOpts): void {
  const { c } = k, osc = c.createOscillator(), g = c.createGain();
  const end = o.at + o.dur;
  osc.type = o.type ?? 'sine';
  if (o.from) { osc.frequency.setValueAtTime(freq * o.from, o.at); osc.frequency.exponentialRampToValueAtTime(freq, o.at + (o.fall ?? o.dur)); }
  else osc.frequency.setValueAtTime(freq, o.at);
  if (o.detune) osc.detune.setValueAtTime(o.detune, o.at);
  if (o.wow) k.wow.connect(osc.detune);
  if (o.vibrato) {
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.setValueAtTime(5.4, o.at);
    depth.gain.setValueAtTime(0, o.at);
    depth.gain.linearRampToValueAtTime(o.vibrato, o.at + Math.min(0.35, o.dur * 0.6));
    lfo.connect(depth).connect(osc.detune);
    lfo.start(o.at); lfo.stop(end + 0.05);
  }
  if (o.shape === 'hold') {
    const attack = Math.min(o.attack ?? 0.02, o.dur * 0.5), release = Math.min(o.release ?? 0.08, o.dur * 0.5);
    g.gain.setValueAtTime(0, o.at);
    g.gain.linearRampToValueAtTime(o.vol, o.at + attack);
    g.gain.setValueAtTime(o.vol, end - release);
    g.gain.linearRampToValueAtTime(0, end);
  } else {
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), o.at + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  osc.connect(g).connect(o.to ?? k.out);
  osc.start(o.at);
  osc.stop(end + 0.05);
}

// ---------------------------------------------------------------- pitched instruments

/** An electric piano: a sine, a soft triangle an octave up, a little bell on the strike. Slow to bloom, long to fade. */
export function epiano(k: Kit, midi: number, at: number, dur: number, vol: number, to: AudioNode = k.pump): void {
  const f = hz(midi);
  tone(k, f, { at, dur, vol, attack: 0.025, detune: -4, wow: true, to });
  tone(k, f * 2, { at, dur: dur * 0.7, vol: vol * 0.18, type: 'triangle', attack: 0.025, detune: 5, wow: true, to });
  tone(k, f * 4, { at, dur: Math.min(0.3, dur), vol: vol * 0.07, attack: 0.004, to });
}
/** A vibraphone: a clear bar and its high partial, into the echo. */
export function vibes(k: Kit, midi: number, at: number, dur: number, vol: number, to: AudioNode = k.right): void {
  const f = hz(midi);
  for (const dest of [to, k.echo]) {
    const v = dest === k.echo ? vol * 0.5 : vol;
    tone(k, f, { at, dur: dur + 0.5, vol: v, attack: 0.006, wow: true, to: dest });
    tone(k, f * 4, { at, dur: 0.22, vol: v * 0.14, attack: 0.003, to: dest });
  }
}
/** A glockenspiel or a music box: brighter and shorter than the vibes. */
export function glock(k: Kit, midi: number, at: number, dur: number, vol: number, to: AudioNode = k.right): void {
  const f = hz(midi);
  for (const dest of [to, k.echo]) {
    const v = dest === k.echo ? vol * 0.45 : vol;
    tone(k, f, { at, dur: dur + 0.35, vol: v, attack: 0.003, to: dest });
    tone(k, f * 2.76, { at, dur: 0.16, vol: v * 0.2, attack: 0.002, to: dest });
    tone(k, f * 5.4, { at, dur: 0.05, vol: v * 0.1, attack: 0.001, to: dest });
  }
}
/** A marimba: a short woody note. */
export function marimba(k: Kit, midi: number, at: number, dur: number, vol: number, to: AudioNode = k.left): void {
  const f = hz(midi);
  tone(k, f, { at, dur: Math.max(0.18, dur), vol, attack: 0.004, to });
  tone(k, f * 4, { at, dur: 0.06, vol: vol * 0.22, attack: 0.002, to });
}
/** A warm pad: each note two triangles a little out of tune, swelling in and out. */
export function pad(k: Kit, chord: readonly number[], at: number, dur: number, vol: number): void {
  for (const midi of chord) for (const cents of [-7, 7]) {
    tone(k, hz(midi), { at, dur, vol: vol * 0.3, type: 'triangle', shape: 'hold', attack: Math.min(0.7, dur * 0.35), release: Math.min(0.9, dur * 0.4), detune: cents, to: k.soft });
  }
}
/** A round bass: a sine with a breath of its octave so a small speaker carries it. */
export function subBass(k: Kit, midi: number, at: number, dur: number, vol: number): void {
  const f = hz(midi);
  tone(k, f, { at, dur, vol: vol * 0.6, shape: 'hold', attack: 0.015, release: 0.09, to: k.pump });
  tone(k, f * 2, { at, dur, vol: vol * 0.2, type: 'triangle', shape: 'hold', attack: 0.015, release: 0.09, to: k.pump });
}
/** A plucked string bass, for walking. */
export function pizz(k: Kit, midi: number, at: number, dur: number, vol: number): void {
  const f = hz(midi);
  tone(k, f, { at, dur: Math.max(0.25, dur), vol, type: 'triangle', attack: 0.006, to: k.low });
  tone(k, f * 2, { at, dur: 0.12, vol: vol * 0.25, attack: 0.004, to: k.low });
}
/** A driving synth bass: a square and a saw through the low-pass, short and hard. */
export function synthBass(k: Kit, midi: number, at: number, dur: number, vol: number): void {
  const f = hz(midi);
  tone(k, f, { at, dur, vol, type: 'square', attack: 0.004, to: k.low });
  tone(k, f, { at, dur, vol: vol * 0.6, type: 'sawtooth', attack: 0.004, detune: 9, to: k.low });
}
/** A chord stabbed short: saws through the soft low-pass. */
export function stab(k: Kit, chord: readonly number[], at: number, dur: number, vol: number): void {
  for (const midi of chord) tone(k, hz(midi), { at, dur, vol: vol / chord.length, type: 'sawtooth', attack: 0.005, to: k.soft });
}
/** A chip-tune voice: a thin square, for arps. */
export function chip(k: Kit, midi: number, at: number, dur: number, vol: number, to: AudioNode = k.soft): void {
  tone(k, hz(midi), { at, dur, vol, type: 'square', shape: 'hold', attack: 0.004, release: Math.min(0.05, dur * 0.4), to });
}
/** A lead that sings: a square and a soft saw, a waver on long notes, into the echo. */
export function lead(k: Kit, midi: number, at: number, dur: number, vol: number): void {
  const f = hz(midi), long = dur > 0.3;
  for (const dest of [k.soft, k.echo]) {
    const v = dest === k.echo ? vol * 0.45 : vol;
    tone(k, f, { at, dur, vol: v, type: 'square', shape: 'hold', attack: 0.012, release: 0.06, vibrato: long ? 14 : 0, to: dest });
    tone(k, f, { at, dur, vol: v * 0.5, type: 'sawtooth', shape: 'hold', attack: 0.012, release: 0.06, detune: 8, to: dest });
  }
}
/** Somebody whistling: a sine that swells, with a waver. */
export function whistle(k: Kit, midi: number, at: number, dur: number, vol: number): void {
  const f = hz(midi);
  for (const dest of [k.right, k.echo]) {
    const v = dest === k.echo ? vol * 0.4 : vol;
    tone(k, f, { at, dur, vol: v, shape: 'hold', attack: 0.05, release: 0.09, vibrato: dur > 0.35 ? 16 : 0, to: dest });
    tone(k, f * 2, { at, dur, vol: v * 0.06, shape: 'hold', attack: 0.05, release: 0.09, to: dest });
  }
}

// ---------------------------------------------------------------- drums, all of them tones

/** A kick: a sine that drops. `hard` adds a click on the front for the loud songs. Everything on the pump bus ducks under it. */
export function kick(k: Kit, at: number, vol: number, hard = false): void {
  tone(k, 46, { at, dur: hard ? 0.26 : 0.34, vol, from: 2.6, fall: hard ? 0.09 : 0.22, attack: 0.004 });
  if (hard) tone(k, 180, { at, dur: 0.03, vol: vol * 0.35, type: 'triangle', from: 5, fall: 0.02, attack: 0.001 });
  const g = k.pump.gain;
  g.setValueAtTime(hard ? 0.5 : 0.62, at);
  g.linearRampToValueAtTime(1, at + 0.24);
}
/** A rim knock, for a soft backbeat: two short tones. */
export function rim(k: Kit, at: number, vol: number): void {
  tone(k, 330, { at, dur: 0.09, vol, type: 'triangle', from: 1.4, fall: 0.06, attack: 0.002 });
  tone(k, 1240, { at, dur: 0.04, vol: vol * 0.32, type: 'triangle', from: 1.4, fall: 0.03, attack: 0.002 });
}
/** A snare made of tones: a body that drops, a bright knock on top. */
export function snare(k: Kit, at: number, vol: number): void {
  tone(k, 165, { at, dur: 0.14, vol, type: 'triangle', from: 1.7, fall: 0.07, attack: 0.002 });
  tone(k, 880, { at, dur: 0.07, vol: vol * 0.4, type: 'triangle', from: 1.5, fall: 0.04, attack: 0.001 });
  tone(k, 2300, { at, dur: 0.035, vol: vol * 0.18, type: 'square', from: 1.3, fall: 0.02, attack: 0.001 });
}
/** A hat: a tiny high blip, clean where noise would hiss. `open` lets it ring a little. */
export function hat(k: Kit, at: number, vol: number, open = false, to: AudioNode = k.air): void {
  tone(k, 7300, { at, dur: open ? 0.11 : 0.03, vol, attack: 0.002, to });
  tone(k, 9600, { at, dur: open ? 0.07 : 0.02, vol: vol * 0.5, type: 'triangle', attack: 0.001, to });
}
/** A tom, for fills: `pitch` 0 high, 1 mid, 2 low. */
export function tom(k: Kit, at: number, vol: number, pitch: 0 | 1 | 2): void {
  tone(k, [150, 118, 92][pitch], { at, dur: 0.2, vol, from: 1.6, fall: 0.1, attack: 0.003 });
}
