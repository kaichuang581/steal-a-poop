import { useStore } from '../state/store';
import { fuseBeat, fuseTones } from './fuseVoices';
import type { TickVoice } from './fuseVoices';

export type SoundKind = 'play' | 'bank' | 'fanfare' | 'fail' | 'trap' | 'roundEnd' | 'alarm' | 'boom' | 'poof' | 'doorShut' | 'doorOpen' | 'crunch';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** One gain node in front of the speakers, set from the volume setting before every sound. */
function destination(c: AudioContext): GainNode {
  if (!master) {
    master = c.createGain();
    master.connect(c.destination);
  }
  master.gain.value = useStore.getState().volume;
  return master;
}

/** Creates/resumes the AudioContext. Browsers only allow this inside a user gesture. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio unavailable: the game stays silent */
  }
}

/** The running audio context, once the first tap or key press has unlocked it (music.ts plays through it). */
export function audioContext(): AudioContext | null {
  return ctx?.state === 'running' ? ctx : null;
}

/** Audio starts only after the first tap or key press; the music starts with it. */
export function installAudioUnlock(): void {
  const handler = () => {
    unlockAudio();
    if (ctx?.state === 'running') {
      void import('./music').then((m) => m.startMusic());
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    }
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
}

function out(): AudioContext | null {
  if (!ctx || ctx.state !== 'running' || useStore.getState().muted) return null;
  return ctx;
}

interface ToneOpts { freq: number; at?: number; dur: number; type?: OscillatorType; vol?: number; to?: number }

function tone(c: AudioContext, { freq, at = 0, dur, type = 'sine', vol = 0.15, to }: ToneOpts) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol * gainScale, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(destination(c));
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** A small bell: the note, its glassy partials, a little of the octave. Every chime in the game is one of these. */
function bell(c: AudioContext, freq: number, at: number, dur: number, vol: number) {
  tone(c, { freq, at, dur, vol });
  tone(c, { freq: freq * 2.76, at, dur: dur * 0.35, vol: vol * 0.18 });
  tone(c, { freq: freq * 5.4, at, dur: dur * 0.12, vol: vol * 0.07 });
}
/** A knock on wood: a short triangle that drops a little, with a soft body under it. */
function wood(c: AudioContext, freq: number, at: number, vol: number) {
  tone(c, { freq: freq * 1.25, at, dur: 0.07, type: 'triangle', vol, to: freq });
  tone(c, { freq: freq / 2, at, dur: 0.09, vol: vol * 0.5 });
}
/** C major pentatonic from C5: every pitched sound picks from it, so nothing clashes with the music. */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

/** Scales every tone's volume while a sound is being scheduled (the dream's alarm plays at low gain). */
let gainScale = 1;

/**
 * How the bomb sounds when it goes off: a shop cosmetic (src/skin/shop/catalog.ts, `burstExplodes`). A worn burst that
 * is not an explosion (a haystack, an aurora) goes off with the soft 'poof', not the ice blast. Never changes the timing.
 */
let softBoom = false;
export function setSoftBoom(soft: boolean): void { softBoom = soft; }

/** `exact` plays the kind asked for; otherwise 'boom' is whatever the worn burst sounds like. */
export function playSound(kind: SoundKind, gain = 1, exact = false): void {
  const c = out();
  if (!c) return;
  gainScale = gain;
  try { schedule(c, kind === 'boom' && softBoom && !exact ? 'poof' : kind); } finally { gainScale = 1; }
}

/**
 * Every sound the game makes, made of tones in the music's key: no buzzy waves and no noise (2026-11-22: a friend of
 * Brian's found the sounds "extremely annoying"; Brian, 2026-11-08: no static). Wood, bells and soft thumps, to fit a
 * farm in the snow.
 */
function schedule(c: AudioContext, kind: SoundKind): void {
  switch (kind) {
    case 'play': // a word taken: a knock and a bell a fifth up
      wood(c, 784, 0, 0.11);
      bell(c, 1174.66, 0.05, 0.28, 0.08);
      break;
    case 'bank': // wool banked: little bells running up the scale
      for (let i = 0; i < 6; i++) bell(c, PENTA[i + 4], i * 0.055, 0.3, 0.045);
      break;
    case 'fanfare': // the winner: a rising call on a soft horn, the last chord held
      [[0, 392], [0.12, 523.25], [0.24, 659.25]].forEach(([at, f]) => {
        tone(c, { freq: f, at, dur: 0.22, type: 'triangle', vol: 0.09 });
        tone(c, { freq: f * 2, at, dur: 0.16, vol: 0.02 });
      });
      for (const f of [523.25, 659.25, 783.99]) tone(c, { freq: f, at: 0.36, dur: 0.9, type: 'triangle', vol: 0.06 });
      bell(c, 2093, 0.36, 0.7, 0.035);
      break;
    case 'fail': // not a word: two soft knocks going down, no buzzer
      wood(c, 330, 0, 0.09);
      wood(c, 262, 0.1, 0.08);
      break;
    case 'trap': // a slip (the dream's crash): a soft slide down and a thud
      tone(c, { freq: 660, dur: 0.28, type: 'triangle', vol: 0.06, to: 220 });
      tone(c, { freq: 110, at: 0.24, dur: 0.2, vol: 0.16, to: 70 });
      break;
    case 'roundEnd':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, f, i * 0.1, 0.45, 0.06));
      break;
    case 'crunch': // your word breaks the frost: a few tiny ice ticks and a clear ping
      [3136, 2637, 3520, 2349].forEach((f, i) => tone(c, { freq: f, at: i * 0.014, dur: 0.035, type: 'triangle', vol: 0.04 }));
      bell(c, 1567.98, 0.02, 0.18, 0.07);
      break;
    case 'boom': // the ice bomb: a deep, round thump, a crack, and ice tinkling down after
      tone(c, { freq: 110, dur: 0.9, vol: 0.55, to: 30 });
      tone(c, { freq: 55, at: 0.02, dur: 1.1, vol: 0.45, to: 24 });
      tone(c, { freq: 240, dur: 0.22, type: 'triangle', vol: 0.12, to: 70 });
      tone(c, { freq: 2600, dur: 0.12, type: 'triangle', vol: 0.07, to: 1100 });
      [10, 7, 9, 5, 8, 6, 10, 4, 7, 9, 5, 8].forEach((p, i) => bell(c, PENTA[p], 0.12 + i * 0.085 + (i % 3) * 0.02, 0.35, 0.03 - i * 0.0015));
      break;
    case 'poof': // the shell falling open and something coming out: a soft pop and three small rising notes
      tone(c, { freq: 190, dur: 0.22, type: 'sine', vol: 0.4, to: 80 });
      tone(c, { freq: 95, at: 0.02, dur: 0.3, type: 'sine', vol: 0.25, to: 50 });
      [659.25, 880, 1318.51].forEach((f, i) => bell(c, f, 0.1 + i * 0.09, 0.5, 0.07));
      break;
    case 'doorShut': // the barn doors meeting: a heavy wooden thud
      tone(c, { freq: 78, dur: 0.32, type: 'sine', vol: 0.3, to: 42 });
      wood(c, 160, 0, 0.06);
      break;
    case 'doorOpen': // the latch lifting
      wood(c, 1046.5, 0, 0.03);
      wood(c, 784, 0.06, 0.025);
      break;
    case 'alarm': // a new round: a farm hand bell rung three times (was a klaxon and a siren). The dream's alarm clock too.
      [[0, 880], [0.2, 659.25], [0.4, 880]].forEach(([at, f]) => bell(c, f, at, 0.6, 0.075));
      break;
  }
}

/** `progress` runs 0 -> 1 across the last 3 seconds; pitch rises with it. */
export function playTick(progress: number): void {
  const c = out();
  if (!c) return;
  // A soft wooden tick that climbs as time runs out (was an electronic beep).
  wood(c, 700 + progress * 600, 0, 0.045);
}

/**
 * The menu: one soft tick each time the choice moves, the same every time (Brian, 2026-11-22: a note per item, falling in
 * pitch, read as "bubbles ... too inconsistent it should be the same sound"). No glide, so it clicks rather than bloops.
 */
export function menuTick(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 1568, dur: 0.028, type: 'triangle', vol: 0.03 });
  tone(c, { freq: 784, dur: 0.035, vol: 0.02 });
}

// The bomb's clock: one sound on each whole second left, all scheduled on the audio clock so they land exactly on the
// beat whatever the screen is doing. What a second sounds like is the fuse voice worn (fuseVoices.ts); when it sounds
// is the same for every voice.
interface Sounding { source: AudioScheduledSourceNode; gain: GainNode; at: number }
let clockNodes: Sounding[] = [];
let sampleNodes: Sounding[] = [];

/** Silences sounds already scheduled: one not begun yet never plays; one ringing fades in a blink, so it does not click. */
function hush(nodes: Sounding[]): void {
  const now = ctx?.currentTime ?? 0;
  for (const n of nodes) {
    try {
      if (n.at > now) { n.source.stop(); n.source.disconnect(); n.gain.disconnect(); continue; }
      const g = n.gain.gain;
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(now);
      g.setTargetAtTime(0, now, 0.015);
      n.source.stop(now + 0.1);
    } catch { /* already finished */ }
  }
}

export function stopBombClock(): void {
  hush(clockNodes);
  clockNodes = [];
}

/** How the bomb's fuse sounds: a shop cosmetic (src/skin/shop/catalog.ts, TICK_VOICE). Never changes the timing. */
export type { TickVoice } from './fuseVoices';
let tickVoice: TickVoice = 'chime';
export function setTickVoice(v: TickVoice): void { tickVoice = v; }

/** Schedules the fuse's sounds for a turn that has `remainingMs` left out of `totalMs`. Replaces any already scheduled. */
export function startBombClock(remainingMs: number, totalMs: number): void {
  stopBombClock();
  const c = out();
  if (!c || remainingMs <= 0 || totalMs <= 0) return;
  const t0 = c.currentTime;
  const dest = destination(c);
  // Nothing for a second the turn does not have: after a bomb has gone off the fuse is lit a beat later, and until
  // then more time is left than the turn is long.
  const whole = Math.floor(totalMs / 1000), secs = Math.min(Math.floor(remainingMs / 1000), whole);
  for (let r = secs; r >= 1; r--) {
    // Sound when `r` whole seconds are left. Time from now to that moment, on the audio clock.
    const at = t0 + (remainingMs - r * 1000) / 1000;
    const through = 1 - r / Math.max(1, totalMs / 1000);
    fuseBeat(c, dest, tickVoice, { at, left: r, through, step: whole - r }, (source, gain, starts) => clockNodes.push({ source, gain, at: starts }), gainScale);
  }
}

/** What a sample plays: three calm seconds of a ten-second turn, then its last three, `SAMPLE_GAP` seconds apart. */
const SAMPLE: readonly [left: number, through: number][] = [[10, 0], [9, 0.1], [8, 0.2], [3, 0.7], [2, 0.8], [1, 0.9]];
const SAMPLE_GAP = 0.6;
/** Until when (performance.now) a sample is playing: the music steps back for it (musicDuck). */
let sampleUntil = 0;

/**
 * A sample of a fuse voice for the shop. Stops the sample before it, if one is still playing. Returns how long this
 * one lasts in milliseconds (0 if nothing can be heard: sound is off, or audio has not been unlocked yet).
 */
export function previewTick(voice: TickVoice): number {
  stopPreviewTick();
  const c = out();
  if (!c) return 0;
  const dest = destination(c);
  const t0 = c.currentTime + 0.05;
  SAMPLE.forEach(([left, through], i) => fuseBeat(c, dest, voice, { at: t0 + i * SAMPLE_GAP, left, through, step: i }, (source, gain, starts) => sampleNodes.push({ source, gain, at: starts })));
  const tail = Math.max(...fuseTones(voice, { at: 0, left: 1, through: 0.9, step: SAMPLE.length - 1 }).map((t) => t.lasts));
  const ms = Math.round((0.05 + (SAMPLE.length - 1) * SAMPLE_GAP + Math.min(tail, 0.6)) * 1000);
  sampleUntil = performance.now() + ms;
  return ms;
}
/** Cuts a sample short: another is starting, or the thing that played it has gone. */
export function stopPreviewTick(): void {
  hush(sampleNodes);
  sampleNodes = [];
  sampleUntil = 0;
}
/** How much of itself the music should play at: it steps back while a fuse sound is being sampled, so the sample is heard. */
export function musicDuck(): number {
  return performance.now() < sampleUntil ? 0.25 : 1;
}

/** The Feed Sack machine's reel: a short wooden click as each tile passes the window. */
export function reelClick(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 900, dur: 0.035, type: 'triangle', vol: 0.05, to: 600 });
}

/** The machine's bell when the reel stops: brighter and longer the rarer the tier (0 common to 3 legendary). */
export function reelDing(tier: number): void {
  const c = out();
  if (!c) return;
  const base = [660, 784, 988, 1175][Math.max(0, Math.min(3, tier))];
  tone(c, { freq: base, dur: 0.35 + tier * 0.15, type: 'triangle', vol: 0.12 });
  tone(c, { freq: base * 1.5, at: 0.08, dur: 0.3 + tier * 0.15, type: 'sine', vol: 0.06 });
  if (tier >= 2) tone(c, { freq: base * 2, at: 0.16, dur: 0.5, type: 'sine', vol: 0.05 });
}

/** The machine's lever going down: a wooden clunk and the ratchet catching. */
export function leverPull(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 190, dur: 0.14, type: 'triangle', vol: 0.14, to: 70 });
  wood(c, 620, 0.11, 0.035);
  wood(c, 520, 0.17, 0.03);
}

/** A little rising tune for a rare prize; a longer one for a legendary. */
export function fanfare(legendary: boolean): void {
  const c = out();
  if (!c) return;
  const notes = legendary ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    tone(c, { freq, at: 0.25 + i * 0.11, dur: 0.24, type: 'triangle', vol: 0.11 });
    tone(c, { freq: freq * 2, at: 0.25 + i * 0.11, dur: 0.18, type: 'sine', vol: 0.03 });
  });
}

/** The Trading Post: a coin dropped on the counter. */
export function coinClink(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 2100, dur: 0.07, type: 'triangle', vol: 0.09 });
  tone(c, { freq: 3150, at: 0.05, dur: 0.16, type: 'sine', vol: 0.06 });
}
/** A sack picked up off the counter: a soft double brush of burlap. */
export function burlapRustle(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 240, dur: 0.06, type: 'triangle', vol: 0.05, to: 140 });
  tone(c, { freq: 200, at: 0.07, dur: 0.07, type: 'triangle', vol: 0.04, to: 110 });
}
/** A Golden Bell spent: one clear ring. */
export function bellChime(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 1318.5, dur: 0.5, type: 'sine', vol: 0.1 });
  tone(c, { freq: 2637, dur: 0.3, type: 'sine', vol: 0.04 });
}
/** The Barn Book opened: a page turned. */
export function pageTurn(): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 520, dur: 0.09, type: 'triangle', vol: 0.045, to: 260 });
  tone(c, { freq: 760, at: 0.06, dur: 0.08, type: 'triangle', vol: 0.03, to: 380 });
}
