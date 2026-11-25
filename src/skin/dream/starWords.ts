import { DOT_FONT } from './dotfont';
import { foldAccents } from '../../lib/lang';

/**
 * Your words become stars (docs/dream/06-beat-and-effects.md, section 5): after each jump the word you used rises into
 * the sky and stays for the rest of the night, spelled in dots. Pure: where each word goes and which dots spell it.
 */
export const STAR_WORDS = { across: 6, down: 5, from: 0.08, to: 0.92, top: 64, aboveLane: 130, nudge: 20, most: 12, dot: 2, pitch: { computer: 4, phone: 3 }, phoneKeeps: 10, newFor: 2000, rise: 700 } as const;

/** A small stable hash of a string and a number, 0 to 1. */
export function hash01(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * The dots of a word, as columns and rows from its top left (one empty column between letters). Accents are dropped;
 * anything that is not a letter leaves a gap two columns wide; at most 12 letters are drawn, and a longer word shows
 * 11 and three dots.
 */
export function wordDots(word: string): { dots: [number, number][]; cols: number } {
  const letters = [...foldAccents(word).toUpperCase()], cut = letters.length > STAR_WORDS.most;
  const shown = cut ? letters.slice(0, STAR_WORDS.most - 1) : letters;
  const dots: [number, number][] = [];
  let x = 0;
  for (const ch of shown) {
    const g = DOT_FONT[ch];
    if (!g) { x += 3; continue; }
    g.forEach((row, r) => [...row].forEach((on, c) => { if (on === '1') dots.push([x + c, r]); }));
    x += g[0].length + 1;
  }
  if (cut) { for (const c of [0, 2, 4]) dots.push([x + c, 4]); x += 6; }
  return { dots, cols: Math.max(0, x - 1) };
}

export interface Place { x: number; y: number }
/**
 * The thirty places over the sky for a window `w` wide whose lane is `lane` px down it: a grid of 6 across and 5 down,
 * from 8% to 92% across and from 64 px under the window's top to 130 px above the lane, each moved up by as much as 20
 * px, in an order shuffled by the night. A place under one of `keepOut` (the counters, the moon) is skipped.
 */
export function starPlaces(w: number, lane: number, seed: string, keepOut: readonly { x: number; y: number; w: number; h: number }[] = []): Place[] {
  const S = STAR_WORDS, y0 = S.top, y1 = Math.max(y0 + 10, lane - S.aboveLane), all: Place[] = [];
  for (let r = 0; r < S.down; r++) for (let c = 0; c < S.across; c++) {
    const i = r * S.across + c;
    all.push({ x: (S.from + ((S.to - S.from) * (c + 0.5)) / S.across) * w, y: y0 + ((y1 - y0) * (r + 0.5)) / S.down - hash01(seed, i) * S.nudge });
  }
  const free = all.filter((p) => !keepOut.some((k) => p.x > k.x - 60 && p.x < k.x + k.w + 60 && p.y > k.y - 14 && p.y < k.y + k.h + 14));
  // Shuffled by the night: each place's own number from the seed, sorted.
  return free.map((p, i) => ({ p, k: hash01(seed, 1000 + i) })).sort((a, b) => a.k - b.k).map((v) => v.p);
}
