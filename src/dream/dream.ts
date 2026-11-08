import type { Dictionary } from '../engine/dictionary';

/**
 * Counting Sheep, the daily dream: the farmer is asleep, and in the thought bubble a sheep runs at a row of fences.
 * Each fence names a few letters in order. Type any real word that has those letters in that order (any letters
 * before, between or after) and the sheep jumps it, and the farmer counts one more. Reach a fence without one and
 * the sheep bumps it. Fences start with one letter and ask for more as the count climbs. Like the offline dinosaur,
 * the fences stand about the same distance apart and the sheep keeps speeding up, so the same gap gives less and less
 * time, and hay bales start turning up close behind the fences. The nightly dream ends after `DREAM_LENGTH.fences` with
 * the farmer asleep, or on the last bump with him awake; practice has no end and one bump finishes it. Everything here
 * is pure and seeded, so the daily dream is the same for everyone; the screen (src/skin/dream) only plays it out.
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

/** A fence, or a hay bale: a quick obstacle close behind the one before it, asking for fewer letters. */
export type Obstacle = 'fence' | 'bale';

export interface Fence {
  index: number;
  kind: Obstacle;
  /** The letters a word must contain, in this order, e.g. ['s', 'p'] for S...P. */
  letters: string[];
  /** A word the letters were taken from, so every fence can be cleared. */
  source: string;
  /** Distance from the previous fence to this one, in logical pixels. */
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

/**
 * How many letters a fence asks for: one for the first few jumps, then two, then three, and never more. Four or five
 * letters left fences with no ordinary word at all (S·W·M·A, S·H·H·E·R).
 */
export function lettersAt(index: number): number {
  if (index < 5) return 1;
  if (index < 16) return 2;
  return 3;
}

/** At least this many of the fence words must fit each fence, by letters asked, so an answer is always easy to find. */
export const MIN_FITS: Record<number, number> = { 1: 25, 2: 12, 3: 6 };
/** Letters a fence never asks for: too few common words have them. */
const RARE = /[jqvxz]/;

/** The nightly dream's shape (V4 Part 15): this many fences puts the farmer to sleep, and this many bumps wakes him. */
export const DREAM_LENGTH: { fences: number; bumps: number } | null = { fences: 30, bumps: 1 };

/** Bales start here, and may come two at a time from `BALE_PAIRS_FROM`; never three. */
export const BALES_FROM = 8;
export const BALE_PAIRS_FROM = 18;
function baleRoll(seed: string, index: number): boolean {
  if (index < BALES_FROM) return false;
  return rng(`${seed}#bale#${index}`)() < Math.min(0.42, 0.16 + (index - BALES_FROM) * 0.012);
}

/** What stands at position `index`: more and more often a bale as the dream goes on. */
export function obstacleAt(seed: string, index: number): Obstacle {
  if (!baleRoll(seed, index)) return 'fence';
  if (obstacleAt(seed, index - 1) !== 'bale') return 'bale';
  return index >= BALE_PAIRS_FROM && obstacleAt(seed, index - 2) !== 'bale' ? 'bale' : 'fence';
}

/** How many letters position `index` asks for: `lettersAt` for a fence; a bale is a quick one, a single letter. */
export function lettersFor(seed: string, index: number): number {
  return obstacleAt(seed, index) === 'bale' ? 1 : lettersAt(index);
}

/** The shortest word that counts. */
export const MIN_WORD = 3;

/** Fences are pure, so each is built once: the reroll for common words makes building one cost a little. */
const built = new Map<string, Fence>();
/** The fence at position `index` of the dream with this seed. */
export function fenceAt(seed: string, index: number): Fence {
  const key = `${seed}#${index}`;
  const hit = built.get(key);
  if (hit) return hit;
  if (built.size > 4000) built.clear();
  const f = buildFence(seed, index);
  built.set(key, f);
  return f;
}
function buildFence(seed: string, index: number): Fence {
  const r = rng(`${seed}#${index}`);
  const kind = obstacleAt(seed, index);
  const k = lettersFor(seed, index);
  // Take the letters, in order, from a word long enough to leave room around them, and keep only a set that plenty of
  // common words fit. Everyone gets the same fence: the tries come from the seeded stream.
  const pool = FENCE_WORDS.filter((w) => w.length >= Math.max(MIN_WORD, k + 1));
  let source = '', letters: string[] = [], best = -1;
  for (let attempt = 0; attempt < 200 && best < MIN_FITS[k]; attempt++) {
    const word = pool[Math.floor(r() * pool.length)];
    const spots = Array.from(word, (_, i) => i);
    const picked: number[] = [];
    while (picked.length < k) picked.push(spots.splice(Math.floor(r() * spots.length), 1)[0]);
    picked.sort((a, b) => a - b);
    const set = picked.map((i) => word[i]);
    if (set.some((c) => RARE.test(c))) continue;
    const fits = FENCE_WORDS.filter((w) => inOrder(set, w)).length;
    if (fits > best) { best = fits; source = word; letters = set; }
  }
  // The distance barely changes, so the rising speed is what closes the gap; a little more room for each letter asked.
  const gap = kind === 'bale' ? 300 + r() * 50 : 760 + (k - 1) * 18 + r() * 80;
  return { index, kind, letters, source, gap };
}

function inOrder(letters: readonly string[], word: string): boolean {
  let k = 0;
  for (const ch of word) if (k < letters.length && ch === letters[k]) k++;
  return k === letters.length;
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

/** The fence's sign: its letters with room between them, e.g. `S…P`, because a word may have anything in the gaps. */
export function signOf(fence: Fence): string {
  return fence.letters.join('…').toUpperCase();
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

/** A word that fits, for a player who has stopped to think: the same for everyone, never the fence's own source. */
export function hintWord(fence: Fence, used: ReadonlySet<string> = new Set()): string {
  const fits = FENCE_WORDS.filter((w) => w !== fence.source && !used.has(w) && w.length <= 6 && matched(fence, w) === fence.letters.length);
  // Short words first; then any length; a used word only when nothing else fits (it would be refused as used).
  const fit = (w: string) => matched(fence, w) === fence.letters.length;
  const longer = FENCE_WORDS.filter((w) => w !== fence.source && !used.has(w) && fit(w));
  const all = fits.length ? fits : longer.length ? longer : FENCE_WORDS.filter(fit);
  return all[Math.floor(rng(`${fence.letters.join('')}#${fence.index}#hint`)() * all.length)] ?? fence.source;
}

// ---------- the run ----------
/** The dream's logical size (pixels), and where the sheep stands. */
export const FIELD = { width: 320, ground: 104, sheepX: 78, sheepW: 20, fenceW: 12, fenceH: 16 } as const;
export const JUMP_MS = 720;
export const JUMP_HEIGHT = 28;

/** Running speed in logical pixels a second after `count` fences, rising to a cap like the offline dinosaur. */
export function speedAt(count: number): number {
  return Math.min(210, 110 + count * 2.6);
}

/** How long a bump holds the sheep up before the lane moves again (V4 Part 15). */
export const STUMBLE_MS = 700;

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
  /** Whether the dream ended on a bump (false when the farmer drifted off, V4 Part 15). */
  bumped?: boolean;
  /** Fences reached, and the positions of the bumps among them, for a dream that has them. */
  fences?: number;
  bumps?: readonly number[];
  /** The dream's seed: the bales change which glyph a position gets. */
  seed?: string;
  /** Where a friend can play. */
  url?: string;
  /** The game's title as the home screen shows it. */
  title?: string;
}

/** One glyph per fence cleared, by the letters it asked: 1 🟩, 2 🟦, 3 🟪; ⬛ for the bump. */
const GLYPHS = ['🟩', '🟦', '🟪', '🟧', '🟥'] as const;
export function dreamGlyphs(count: number, bumped = true, run: { seed?: string; bumps?: readonly number[] } = {}): string {
  const row: string[] = [];
  const bumps = run.bumps ?? [];
  const letters = (i: number) => (run.seed ? lettersFor(run.seed, i) : lettersAt(i));
  // Each bump sits where it happened; a dream that recorded none ends on the one that finished it.
  for (let i = 0; i < count + bumps.length; i++) row.push(bumps.includes(i) ? '⬛' : GLYPHS[Math.min(5, letters(i)) - 1]);
  if (bumped && bumps.length === 0) row.push('⬛');
  if (row.length === 0) return '⬛';
  const groups: string[] = [];
  for (let i = 0; i < row.length; i += 5) groups.push(row.slice(i, i + 5).join(''));
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += 8) lines.push(groups.slice(i, i + 8).join(' '));
  return lines.join('\n');
}

const BUMP_WORDS = ['no bumps', 'one bump', 'two bumps'];
/** "Asleep after 30 fences, one bump, longest word 9 letters": the line a finished night is told in. */
export function dreamSummary(r: Pick<DreamResult, 'fences' | 'bumps' | 'longest'>): string {
  const bumps = r.bumps?.length ?? 0;
  return `Asleep after ${r.fences} fences, ${BUMP_WORDS[bumps] ?? `${bumps} bumps`}, longest word ${r.longest} letters`;
}

/** The spoiler-free result to share (V4 Part 13.2). */
export function dreamShareText(r: DreamResult): string {
  const bumped = r.bumped ?? true;
  const asleep = !bumped && !!r.fences;
  const streak = r.streak > 1 ? `${r.streak}-night streak${r.blankets ? ` · 🛏 ${r.blankets} Warm Blanket${r.blankets === 1 ? '' : 's'}` : ''}` : '';
  return [
    `${r.title ?? 'Counting Sheep'} · Counting Sheep ${r.date}`,
    asleep ? dreamSummary(r) : `The farmer counted ${r.count} sheep ${bumped ? 'then woke up' : 'and drifted off'}`,
    dreamGlyphs(r.count, bumped, { seed: r.seed, bumps: r.bumps }),
    !asleep && r.longest > 0 ? `Longest word: ${r.longest} letters` : '',
    streak,
    r.url ?? '',
  ].filter(Boolean).join('\n');
}
