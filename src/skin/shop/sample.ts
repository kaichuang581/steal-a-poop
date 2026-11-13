import { create } from 'zustand';
import { previewTick, stopPreviewTick } from '../../audio/sound';
import { TICK_VOICE } from './catalog';

/**
 * Listening to a fuse sound in the Trading Post: one sample at a time, and the thing that played it shows that it is
 * playing (Brian, 2026-11-13: "i dont see them working"). A card's speaker, the closer look's Listen and the fair
 * machine's prize all play through here.
 */
const useSampling = create<{ id: string | null }>(() => ({ id: null }));
let timer = 0;

/** Plays an item's sample from the start. False if nothing can be heard (sound is switched off). */
export function playSample(id: string): boolean {
  window.clearTimeout(timer);
  const ms = previewTick(TICK_VOICE[id] ?? 'chime');
  useSampling.setState({ id: ms ? id : null });
  if (ms) timer = window.setTimeout(() => useSampling.setState({ id: null }), ms);
  return ms > 0;
}
/** Stops whatever sample is playing: the shop, the closer look or the machine has closed. */
export function stopSample(): void {
  window.clearTimeout(timer);
  stopPreviewTick();
  useSampling.setState({ id: null });
}
/** Whether this item's sample is the one playing now. */
export const useSampleOf = (id: string): boolean => useSampling((s) => s.id === id);
/** What to say when a sample cannot be heard. */
export const SOUND_OFF_NOTE = 'Sound is off. Turn it on with the speaker button at the top.';
