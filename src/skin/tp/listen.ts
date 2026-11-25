import type { Group } from 'three';
import { playSample, stopSample } from '../shop/sample';

/**
 * Stub (T4): the main thread's src/skin/tp/listen.ts replaces this at merge. Plays an item's fuse sound, one at a time,
 * obeying mute; the real one also moves `model` while it plays.
 */
export function listen(itemId: string, model?: Group): void { void model; playSample(itemId); }
export function stopListening(): void { stopSample(); }
