import type { Dictionary } from '../engine/dictionary';

/**
 * Counting Sheep, the daily dream: the farmer is asleep, and in the thought bubble a sheep runs at a row of fences.
 * Each fence carries a word with letters missing. Type letters that finish it into any real word and the sheep
 * jumps it, and the farmer counts one more. Reach a fence unfinished and the sheep bumps it: the farmer wakes up.
 * The fences speed up and lose more letters as the count climbs. Everything here is pure and seeded, so the
 * daily dream is the same for everyone; the screen (src/skin/dream) only plays it out.
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
  /** The word the fence was cut from (the letters it shows are this word's). */
  word: string;
  /** Positions in `word` that are blank, ascending. */
  blanks: number[];
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

/** Word lengths allowed at a fence: short words first, longer ones as the count climbs. */
export function lengthsAt(index: number): [number, number] {
  if (index < 6) return [3, 4];
  if (index < 16) return [4, 5];
  if (index < 30) return [5, 6];
  return [5, 8];
}

/** How many letters a fence hides: one at first, then two, then sometimes three in the long words. */
export function blanksAt(index: number, length: number, roll: number): number {
  if (index < 5) return 1;
  if (index < 14) return roll < 0.5 ? 1 : 2;
  if (index < 28 || length < 6) return 2;
  return roll < 0.5 ? 2 : 3;
}

/** The fence at position `index` of the dream with this seed. */
export function fenceAt(seed: string, index: number): Fence {
  const r = rng(`${seed}#${index}`);
  const [lo, hi] = lengthsAt(index);
  const pool = FENCE_WORDS.filter((w) => w.length >= lo && w.length <= hi);
  const word = pool[Math.floor(r() * pool.length)];
  const count = blanksAt(index, word.length, r());
  const spots = Array.from(word, (_, i) => i);
  const blanks: number[] = [];
  while (blanks.length < count) blanks.push(spots.splice(Math.floor(r() * spots.length), 1)[0]);
  blanks.sort((a, b) => a - b);
  // Time to type: a long breath at first, tightening to a floor, plus a little for every extra blank.
  const gap = index === 0 ? 3.2 : Math.max(2.1, 4.4 - index * 0.07) + (count - 1) * 0.55 + r() * 0.7;
  return { index, word, blanks, gap };
}

/** The fence's face with the typed letters filled in, blanks as `_`, e.g. `SH_EP`. */
export function faceOf(fence: Fence, typed: string): string {
  let k = 0;
  return Array.from(fence.word, (ch, i) => (fence.blanks.includes(i) ? (typed[k++] ?? '_') : ch)).join('').toUpperCase();
}

export type Fill = 'more' | 'ok' | 'wrong';

/** Whether the typed letters finish the fence: any real word that fits counts, not only the one it was cut from. */
export function tryFill(dict: Dictionary, fence: Fence, typed: string): Fill {
  if (typed.length < fence.blanks.length) return 'more';
  return dict.has(faceOf(fence, typed).toLowerCase()) ? 'ok' : 'wrong';
}

// ---------- the run ----------
/** The dream's logical size (pixels), and where the sheep stands. */
export const FIELD = { width: 320, ground: 104, sheepX: 78, sheepW: 20, fenceW: 12, fenceH: 16 } as const;
export const JUMP_MS = 600;
export const JUMP_HEIGHT = 28;

/** Running speed in logical pixels a second after `count` fences, rising to a cap like the offline dinosaur. */
export function speedAt(count: number): number {
  return Math.min(120, 64 + count * 2.5);
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
  /** Fences finished with a different word than the one they were cut from. */
  lucid: number;
  streak: number;
}

/** The spoiler-free result to share. */
export function dreamShareText(r: DreamResult): string {
  const sheep = '🐑'.repeat(Math.min(10, Math.ceil(r.count / 5)));
  return [
    `Finish the Word · Counting Sheep ${r.date}`,
    `🛏️ The farmer counted ${r.count} sheep${r.count >= 40 ? ' and drifted off 💤' : ' then woke up ⏰'}`,
    sheep,
    r.lucid > 0 ? `✨ ${r.lucid} lucid jump${r.lucid === 1 ? '' : 's'}` : '',
    r.streak > 1 ? `🔥 ${r.streak}-night streak` : '',
  ].filter(Boolean).join('\n');
}
