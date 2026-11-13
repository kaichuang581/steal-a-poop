import { useStore } from '../state/store';
import { fuseBeat, fuseTones } from './fuseVoices';
import type { TickVoice } from './fuseVoices';

export type SoundKind = 'play' | 'bank' | 'fanfare' | 'fail' | 'trap' | 'roundEnd' | 'alarm' | 'boom' | 'poof' | 'doorShut' | 'doorOpen' | 'crunch';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
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

function whoosh(c: AudioContext, at: number, dur: number, from: number, to: number, vol: number) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol * gainScale, t0 + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(destination(c));
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

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

function schedule(c: AudioContext, kind: SoundKind): void {
  switch (kind) {
    case 'play':
      tone(c, { freq: 520, dur: 0.09, type: 'triangle', vol: 0.12, to: 700 });
      break;
    case 'bank': // coin cascade
      for (let i = 0; i < 7; i++) {
        tone(c, { freq: 1100 + Math.random() * 900, at: i * 0.055, dur: 0.12, type: 'square', vol: 0.05 });
        tone(c, { freq: 2200 + Math.random() * 800, at: i * 0.055, dur: 0.09, type: 'triangle', vol: 0.04 });
      }
      break;
    case 'fanfare':
      whoosh(c, 0, 0.32, 400, 3200, 0.25);
      tone(c, { freq: 330, at: 0.28, dur: 0.14, type: 'sawtooth', vol: 0.1 });
      tone(c, { freq: 495, at: 0.36, dur: 0.14, type: 'sawtooth', vol: 0.1 });
      tone(c, { freq: 660, at: 0.44, dur: 0.3, type: 'sawtooth', vol: 0.12 });
      break;
    case 'fail':
      tone(c, { freq: 140, dur: 0.28, type: 'sawtooth', vol: 0.14, to: 90 });
      tone(c, { freq: 147, dur: 0.28, type: 'square', vol: 0.06, to: 95 });
      break;
    case 'trap':
      tone(c, { freq: 700, dur: 0.32, type: 'square', vol: 0.09, to: 120 });
      tone(c, { freq: 90, at: 0.3, dur: 0.15, type: 'sine', vol: 0.18 });
      break;
    case 'roundEnd':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, at: i * 0.11, dur: 0.3, type: 'triangle', vol: 0.1 }));
      break;
    case 'crunch': // your word breaks the frost: a short bright crackle and a click
      whoosh(c, 0, 0.09, 7000, 2500, 0.32);
      whoosh(c, 0.03, 0.07, 4000, 1500, 0.2);
      tone(c, { freq: 1600, dur: 0.04, type: 'square', vol: 0.05, to: 900 });
      break;
    case 'boom': // the ice bomb: a glassy crack, a deep thump, shards of ice tinkling down and a freezing gust after
      whoosh(c, 0, 0.12, 9000, 3000, 0.9);
      whoosh(c, 0, 1.2, 2000, 70, 0.9);
      whoosh(c, 0.05, 0.6, 600, 60, 0.8);
      tone(c, { freq: 100, dur: 1.0, type: 'sine', vol: 0.95, to: 24 });
      tone(c, { freq: 45, at: 0.03, dur: 1.2, type: 'sine', vol: 0.8, to: 20 });
      tone(c, { freq: 2600, dur: 0.18, type: 'triangle', vol: 0.18, to: 900 });
      for (let i = 0; i < 26; i++) tone(c, { freq: 2200 + Math.random() * 4800, at: 0.1 + Math.random() * 1.1, dur: 0.06 + Math.random() * 0.12, type: i % 3 ? 'sine' : 'triangle', vol: 0.05 + Math.random() * 0.05 });
      whoosh(c, 0.35, 1.6, 1400, 4200, 0.35);
      break;
    case 'poof': // the shell falling open and something coming out: a soft pop, a breath of air, three small rising notes
      tone(c, { freq: 190, dur: 0.22, type: 'sine', vol: 0.55, to: 80 });
      tone(c, { freq: 95, at: 0.02, dur: 0.3, type: 'sine', vol: 0.35, to: 50 });
      whoosh(c, 0, 0.3, 700, 2600, 0.22);
      [660, 880, 1320].forEach((f, i) => tone(c, { freq: f, at: 0.1 + i * 0.09, dur: 0.5, type: 'sine', vol: 0.09 }));
      [1320, 1760, 2640].forEach((f, i) => tone(c, { freq: f, at: 0.1 + i * 0.09, dur: 0.3, type: 'triangle', vol: 0.03 }));
      break;
    case 'doorShut': // the barn doors meeting: a heavy wooden thud, a short rattle of the latch
      tone(c, { freq: 78, dur: 0.32, type: 'sine', vol: 0.32, to: 42 });
      tone(c, { freq: 160, dur: 0.08, type: 'triangle', vol: 0.08, to: 90 });
      whoosh(c, 0, 0.14, 900, 200, 0.28);
      tone(c, { freq: 1900, at: 0.09, dur: 0.035, type: 'square', vol: 0.025 });
      tone(c, { freq: 1500, at: 0.15, dur: 0.03, type: 'square', vol: 0.018 });
      break;
    case 'doorOpen': // the latch lifting, then the doors creaking in on their hinges
      tone(c, { freq: 2100, dur: 0.03, type: 'square', vol: 0.03 });
      tone(c, { freq: 1300, at: 0.05, dur: 0.04, type: 'square', vol: 0.02 });
      tone(c, { freq: 210, at: 0.12, dur: 0.55, type: 'sawtooth', vol: 0.022, to: 150 });
      tone(c, { freq: 231, at: 0.16, dur: 0.5, type: 'sawtooth', vol: 0.016, to: 170 });
      whoosh(c, 0.1, 0.8, 300, 1400, 0.16);
      break;
    case 'alarm': // the barn klaxon: two notes blared three times over a rising and falling siren
      for (let i = 0; i < 6; i++) tone(c, { freq: i % 2 ? 415 : 554, at: i * 0.22, dur: 0.2, type: 'square', vol: 0.085 });
      tone(c, { freq: 220, dur: 0.68, type: 'sawtooth', vol: 0.06, to: 440 });
      tone(c, { freq: 440, at: 0.68, dur: 0.68, type: 'sawtooth', vol: 0.06, to: 220 });
      break;
  }
}

/** `progress` runs 0 -> 1 across the last 3 seconds; pitch rises with it. */
export function playTick(progress: number): void {
  const c = out();
  if (!c) return;
  tone(c, { freq: 600 + progress * 1000, dur: 0.05, type: 'square', vol: 0.06 });
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
  tone(c, { freq: 620, at: 0.11, dur: 0.04, type: 'square', vol: 0.035 });
  tone(c, { freq: 520, at: 0.17, dur: 0.04, type: 'square', vol: 0.03 });
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
