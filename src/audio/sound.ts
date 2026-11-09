import { useStore } from '../state/store';

export type SoundKind = 'play' | 'bank' | 'fanfare' | 'fail' | 'trap' | 'roundEnd' | 'alarm' | 'boom';

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

/** Audio starts only after the first tap or key press; the lofi loop starts with it. */
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

export function playSound(kind: SoundKind, gain = 1): void {
  const c = out();
  if (!c) return;
  gainScale = gain;
  try { schedule(c, kind); } finally { gainScale = 1; }
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

// The bomb's clock: one beep on each whole second left, all scheduled on the audio clock so they land exactly on the
// beat whatever the screen is doing. The beeps climb in pitch and loudness as the fuse burns down; the last three
// seconds are at full volume with a harder edge.
let clockNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

export function stopBombClock(): void {
  for (const n of clockNodes) {
    try { n.osc.stop(); } catch { /* already finished */ }
    try { n.osc.disconnect(); n.gain.disconnect(); } catch { /* ignore */ }
  }
  clockNodes = [];
}

/** Schedules the beeps for a turn that has `remainingMs` left out of `totalMs`. Replaces any beeps already scheduled. */
export function startBombClock(remainingMs: number, totalMs: number): void {
  stopBombClock();
  const c = out();
  if (!c || remainingMs <= 0 || totalMs <= 0) return;
  const t0 = c.currentTime;
  const dest = destination(c);
  const secs = Math.floor(remainingMs / 1000);
  for (let r = secs; r >= 1; r--) {
    // Beep when `r` whole seconds are left. Time from now to that moment, on the audio clock.
    const at = t0 + (remainingMs - r * 1000) / 1000;
    const u = 1 - r / Math.max(1, totalMs / 1000); // 0 at the start of the turn, toward 1 at the end
    const finale = r <= 3;
    const freq = finale ? 1100 + (3 - r) * 180 : 520 + u * 480;
    const vol = finale ? 0.9 : 0.08 + u * 0.22;
    const dur = finale ? 0.22 : 0.12;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = finale ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * gainScale), at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.03);
    clockNodes.push({ osc, gain });
    if (finale) {
      // A harder second voice for the last three seconds, a fifth above, so they are as loud as the sound can get.
      const o2 = c.createOscillator();
      const g2 = c.createGain();
      o2.type = 'sawtooth';
      o2.frequency.setValueAtTime(freq * 1.5, at);
      g2.gain.setValueAtTime(0.0001, at);
      g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * gainScale), at + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o2.connect(g2).connect(dest);
      o2.start(at);
      o2.stop(at + dur + 0.03);
      clockNodes.push({ osc: o2, gain: g2 });
    }
  }
}
