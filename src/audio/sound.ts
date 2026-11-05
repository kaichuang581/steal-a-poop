import { useStore } from '../state/store';

export type SoundKind = 'play' | 'bank' | 'steal' | 'fail' | 'trap' | 'roundEnd' | 'alarm';

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

/** Audio starts only after the first tap or key press. */
export function installAudioUnlock(): void {
  const handler = () => {
    unlockAudio();
    if (ctx?.state === 'running') {
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
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
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
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(destination(c));
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export function playSound(kind: SoundKind): void {
  const c = out();
  if (!c) return;
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
    case 'steal':
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
