import type { Object3D } from 'three';
import { previewTick, stopPreviewTick } from '../../audio/sound';
import { TICK_VOICE } from '../shop/catalog';

/**
 * Listen (docs/trading-post-practice/T4): a sample of a fuse sound, one at a time and only when sound is on, while
 * its model moves: the chime sways, the pocket game pulses, the block taps, the cowbell swings, the sleigh bells
 * shake, the music box turns, the owl bobs, the moon rocks. Each motion is a fixed curve; nothing is random. Under
 * reduced motion the sound plays and nothing moves.
 */
type Move = (t: number, o: Object3D) => void;
const MOVES: Record<string, Move> = {
  'tick-chime': (t, o) => { o.rotation.z = 0.07 * Math.sin(t * 9); },
  'tick-8bit': (t, o) => { o.scale.setScalar(1 + 0.04 * (Math.sin(t * 25) > 0 ? 1 : 0)); },
  'tick-wood': (t, o) => { o.position.y += 0.015 * Math.max(0, Math.sin(t * 10)); },
  'tick-cowbell': (t, o) => { o.rotation.z = 0.12 * Math.sin(t * 8); },
  'tick-sleigh': (t, o) => { o.position.x += 0.01 * Math.sin(t * 40); o.rotation.z = 0.03 * Math.sin(t * 33); },
  'tick-musicbox': (t, o) => { o.rotation.y = 0.35 * Math.sin(t * 2.4); },
  'tick-owl': (t, o) => { o.rotation.x = 0.08 * Math.sin(t * 6); },
  'tick-lullaby': (t, o) => { o.rotation.z = 0.1 * Math.sin(t * 3); },
};

let playing: { stop: () => void } | null = null;

/** Plays the fuse sound `itemId` (a catalogue id) and moves `model` while it lasts. Returns the sample's length in ms. */
export function listen(itemId: string, model?: Object3D): number {
  stopListening();
  const voice = TICK_VOICE[itemId];
  if (!voice) return 0;
  const ms = previewTick(voice);
  const move = MOVES[itemId];
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!model || !move || !ms || still) { playing = { stop: stopPreviewTick }; return ms; }
  const rest = { p: model.position.clone(), r: model.rotation.clone(), s: model.scale.clone() };
  const reset = () => { model.position.copy(rest.p); model.rotation.copy(rest.r); model.scale.copy(rest.s); };
  const t0 = performance.now();
  let raf = 0;
  const step = () => {
    const e = performance.now() - t0;
    reset();
    if (e >= ms) return;
    move(e / 1000, model);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  playing = { stop: () => { cancelAnimationFrame(raf); reset(); stopPreviewTick(); } };
  return ms;
}

/** Stops whatever is playing and puts its model back. */
export function stopListening(): void {
  playing?.stop();
  playing = null;
}
