/**
 * Which music is wanted now (Brian, 2026-11-13: "the calm lofi should only be in the start screen. once u go in the
 * game, change it to something more intense ... ensure each gamemode and when u switch onto something else the music
 * changes"). The app says where the player is; the music (music.ts, loaded only once sound is unlocked) reads it and
 * crossfades to that screen's song. No imports, so anything may set it.
 *
 * home: the start screen, calm lofi. shop: the Trading Post, a shop shuffle. lobby: a room waiting to start. battle: the
 * word game itself, against bots or people. practice: the practice run. tour: the tutorial. dream: Counting Sheep.
 */
export type MusicScene = 'home' | 'shop' | 'lobby' | 'battle' | 'practice' | 'tour' | 'dream';
export const MUSIC_SCENES: readonly MusicScene[] = ['home', 'shop', 'lobby', 'battle', 'practice', 'tour', 'dream'];

/** How hard the battle song plays: -1 once the game is over (the storm has passed), then 0 to 3 as the rounds go by. */
export type Heat = -1 | 0 | 1 | 2 | 3;

let base: MusicScene = 'home';
let over: MusicScene | null = null;
let heat: Heat = 0;

/** Where the player is: the screen or game mode under any overlay. */
export function setMusicScene(scene: MusicScene, level: Heat = 0): void { base = scene; heat = level; }
/** Something opened over that screen with music of its own (the Trading Post), or null when it shuts. */
export function setMusicOverlay(scene: MusicScene | null): void { over = scene; }
/** The song wanted now, and how hard to play it. */
export function musicScene(): { scene: MusicScene; heat: Heat } { return { scene: over ?? base, heat: over ? 0 : heat }; }

/** The battle song's heat for a round of a game: calm in the first round, flat out from the fourth, as the fuses get shorter. */
export function heatFor(round: number, over: boolean): Heat {
  return over ? -1 : (Math.max(0, Math.min(3, round - 1)) as Heat);
}
