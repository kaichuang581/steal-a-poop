import type { Dictionary } from '../engine/dictionary';

/**
 * Counting Sheep, the daily dream: the farmer is asleep, and in the thought bubble a sheep runs at a row of fences.
 * Each fence names a few letters in order. Type any real word that has those letters in that order (any letters
 * before, between or after) and the sheep jumps it, and the farmer counts one more. Reach a fence without one and
 * the sheep bumps it: the farmer wakes up. Fences start with one letter and ask for more as the count climbs, and the
 * sheep runs faster. Everything here is pure and seeded, so the daily dream is the same for everyone; the screen
 * (src/skin/dream) only plays it out.
 */

/** Words the fences are cut from: common, sleepy, farmy. Any real word that fits the blanks is accepted. */
export const FENCE_WORDS: readonly string[] = (
  'bed cap cow dog hay hen ram ewe pig owl sky sun nap dew fog ice oak elm hut pen jar mug cup rug hat toe bun pie ' +
  'barn bell boot calf cart coat corn dawn deer dove dusk farm fawn fern gate goat hill horn lamb lane moon moss nest ' +
  'pail pond rain rest road seed snow star tree wool yard wind wish milk bunk doze lull calm cozy dark glow hush ' +
  'mild rope sled song soup warm leaf lake mist bird frog cake rose pine wolf ' +
  'sheep fence field grass horse straw quilt pillow dream sleep night stars cloud blink tired yawn hoof flock shear ' +
  'apple bread cream cabin chair clock house light lamps moose otter goose geese mouse snore stove sweet storm frost ' +
  'trees river stone porch fluff fuzzy hills shade plush bunny daisy tulip maple acorn berry honey candy music piano ' +
  'sleepy bedtime blanket meadow lullaby slumber pasture shepherd farmer tractor kitten puppy rabbit pumpkin ' +
  'garden window candle cookie muffin pickle carrot turnip potato forest valley silver golden purple yellow ' +
  'orange cotton velvet feather pajamas snooze cuddle starry moonlit twinkle evening morning sunrise sunset dreamer ' +
  'counting jumping barnyard haystack orchard chicken rooster duckling kittens pillows blankets bedroom ' +
  'nightcap fireside bubbles rainbow snowman sweater mittens lantern cricket firefly'
).split(' ');

export interface Fence {
  index: number;
  /** The letters a word must contain, in this order, e.g. ['s', 'p'] for S...P. */
  letters: string[];
  /** A word the letters were taken from, so every fence can be cleared. */
  source: string;
  /** Seconds of running from the previous fence to this one. */
  gap: number;
}

// ---------- seeded random ----------
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed of a day's dream: everyone gets the same fences. */
export function dreamSeed(dateKey: string): string {
  return `dream:${dateKey}`;
}

/** How many letters a fence asks for: one for the first few jumps, then two, three, four and five. */
export function lettersAt(index: number): number {
  if (index < 3) return 1;
  if (index < 8) return 2;
  if (index < 15) return 3;
  if (index < 25) return 4;
  return 5;
}

/** The shortest word that counts. */
export const MIN_WORD = 3;

/** The fence at position `index` of the dream with this seed. */
export function fenceAt(seed: string, index: number): Fence {
  const r = rng(`${seed}#${index}`);
  const k = lettersAt(index);
  // Take the letters, in order, from a word long enough to leave room around them.
  const pool = FENCE_WORDS.filter((w) => w.length >= Math.max(MIN_WORD, k + 1));
  const source = pool[Math.floor(r() * pool.length)];
  const spots = Array.from(source, (_, i) => i);
  const picked: number[] = [];
  while (picked.length < k) picked.push(spots.splice(Math.floor(r() * spots.length), 1)[0]);
  picked.sort((a, b) => a - b);
  const letters = picked.map((i) => source[i]);
  // Time to think and type: a long breath at first, tightening to a floor, a little more for each letter asked.
  const gap = index === 0 ? 3.6 : Math.max(2.8, 4.8 - index * 0.05) + (k - 1) * 0.35 + r() * 0.6;
  return { index, letters, source, gap };
}

/** How many of the fence's letters `typed` already has in order (greedy from the left). */
export function matched(fence: Fence, typed: string): number {
  let k = 0;
  for (const ch of typed.toLowerCase()) if (k < fence.letters.length && ch === fence.letters[k]) k++;
  return k;
}

export type Verdict = { ok: true } | { ok: false; reason: 'short' | 'letters' | 'word' | 'used' };

/** Whether `typed` clears the fence: a real word of 3+ letters, not used yet this dream, with the letters in order. */
export function check(dict: Dictionary, fence: Fence, typed: string, used: ReadonlySet<string>): Verdict {
  const w = typed.trim().toLowerCase();
  if (w.length < MIN_WORD) return { ok: false, reason: 'short' };
  if (matched(fence, w) < fence.letters.length) return { ok: false, reason: 'letters' };
  if (!dict.has(w)) return { ok: false, reason: 'word' };
  if (used.has(w)) return { ok: false, reason: 'used' };
  return { ok: true };
}

/** The fence's sign: its letters with dots between, e.g. `S·P`. */
export function signOf(fence: Fence): string {
  return fence.letters.join('·').toUpperCase();
}

/**
 * Example words for the first three fences only (V4 Part 13.1): up to three fence words that fit, never the fence's
 * own source, seeded by the fence so everyone sees the same ones, shortest first. Nothing from the fourth fence on.
 */
export function exampleWords(fence: Fence): string[] {
  if (fence.index >= 3) return [];
  const fits = FENCE_WORDS.filter((w) => w !== fence.source && matched(fence, w) === fence.letters.length);
  const r = rng(`${fence.letters.join('')}#${fence.index}#examples`);
  const picked: string[] = [];
  const pool = [...fits];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return picked.sort((a, b) => a.length - b.length || a.localeCompare(b));
}

// ---------- the run ----------
/** The dream's logical size (pixels), and where the sheep stands. */
export const FIELD = { width: 320, ground: 104, sheepX: 78, sheepW: 20, fenceW: 12, fenceH: 16 } as const;
export const JUMP_MS = 600;
export const JUMP_HEIGHT = 28;

/** Running speed in logical pixels a second after `count` fences, rising to a cap like the offline dinosaur. */
export function speedAt(count: number): number {
  return Math.min(100, 58 + count * 2);
}

/** The gap between the sheep and a finished fence when the sheep takes off, so the top of the jump is over it. */
export function takeoffDistance(speed: number): number {
  return (speed * JUMP_MS) / 2000 - FIELD.sheepW / 2 - FIELD.fenceW / 2;
}

/** Height of the jump `ms` after take-off (0 on the ground). */
export function jumpHeight(ms: number): number {
  if (ms <= 0 || ms >= JUMP_MS) return 0;
  const t = ms / JUMP_MS;
  return 4 * JUMP_HEIGHT * t * (1 - t);
}

// ---------- the result ----------
export interface DreamResult {
  date: string;
  count: number;
  /** Letters in the longest word typed. */
  longest: number;
  streak: number;
  /** Warm Blankets held (V4 Part 12). */
  blankets?: number;
  /** Whether the dream ended on a bump (false only in the bounded dream's drift-off, V4 Part 15, not approved). */
  bumped?: boolean;
  /** The game's title as the home screen shows it. */
  title?: string;
}

/** One glyph per fence cleared, by the letters it asked: 1 🟩, 2 🟦, 3 🟪, 4 🟧, 5 🟥; ⬛ for the bump. */
const GLYPHS = ['🟩', '🟦', '🟪', '🟧', '🟥'] as const;
export function dreamGlyphs(count: number, bumped = true): string {
  const row: string[] = [];
  for (let i = 0; i < count; i++) row.push(GLYPHS[Math.min(5, lettersAt(i)) - 1]);
  if (bumped) row.push('⬛');
  if (row.length === 0) return '⬛';
  const groups: string[] = [];
  for (let i = 0; i < row.length; i += 5) groups.push(row.slice(i, i + 5).join(''));
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += 8) lines.push(groups.slice(i, i + 8).join(' '));
  return lines.join('\n');
}

/** The spoiler-free result to share (V4 Part 13.2). */
export function dreamShareText(r: DreamResult): string {
  const bumped = r.bumped ?? true;
  const streak = r.streak > 1 ? `${r.streak}-night streak${r.blankets ? ` · 🛏 ${r.blankets} Warm Blanket${r.blankets === 1 ? '' : 's'}` : ''}` : '';
  return [
    `${r.title ?? 'Counting Sheep'} · Counting Sheep ${r.date}`,
    `The farmer counted ${r.count} sheep ${bumped ? 'then woke up' : 'and drifted off'}`,
    dreamGlyphs(r.count, bumped),
    r.longest > 0 ? `Longest word: ${r.longest} letters` : '',
    streak,
  ].filter(Boolean).join('\n');
}
