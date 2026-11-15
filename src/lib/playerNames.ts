import { isInappropriateName } from './nickname';

/**
 * Names for the bots that fill the casual queue, made to read like names players pick for themselves (Brian,
 * 2026-11-14: "make it look like actual player generated names ... whether thats a cool and sleak 4 letter name like
 * kxln or something like bignatefan27"). The patterns, from a short look at how players name themselves:
 *  - numbers on the end are the most common habit, very often a birth year, as two digits or four (a study of about
 *    500,000 League of Legends names matched them to the year players gave at sign-up), or digits added because the
 *    name was taken;
 *  - short "OG" names of three or four letters, mostly consonants, sometimes with one digit (kxln, z4ck);
 *  - fan names (bignatefan27), "its"/"lil"/"not"/"the" in front, an underscore between two words (sleepy_moon),
 *    and two capitalised words run together (FrostyTaco).
 * Every name is at most 12 characters (the room's limit), and every one passes the same check players' names do.
 */
export const PLAYER_NAME_MAX = 12;

const FIRST = ['nate', 'jake', 'maya', 'ava', 'liam', 'noah', 'emma', 'mia', 'leo', 'max', 'zoe', 'eli', 'owen', 'ella', 'sam', 'kai', 'luca', 'nora', 'ben', 'ivy', 'finn', 'ruby', 'jay', 'lily', 'theo', 'cole', 'aria', 'milo', 'jade', 'evan'];
const THINGS = ['taco', 'pizza', 'dino', 'panda', 'ninja', 'cookie', 'pickle', 'moon', 'cloud', 'frog', 'waffle', 'comet', 'nugget', 'banana', 'shark', 'llama', 'bean', 'fox', 'owl', 'mango'];
const ADJ = ['Silent', 'Frosty', 'Sneaky', 'Swift', 'Lucky', 'Fuzzy', 'Cosmic', 'Sleepy', 'Mighty', 'Turbo', 'Pixel', 'Shadow', 'Crispy', 'Salty', 'Epic', 'Chill'];
const NOUN = ['Fox', 'Taco', 'Wolf', 'Bean', 'Duck', 'Owl', 'Toast', 'Frog', 'Bear', 'Moose', 'Hawk', 'Yeti', 'Llama', 'Panda', 'Comet', 'Byte'];
const SOFT = ['sleepy', 'cloud', 'moon', 'star', 'honey', 'mint', 'peach', 'cozy', 'misty', 'berry'];
const SOFT_END = ['kid', 'vibes', 'moon', 'bean', 'cat', 'zz', 'dust', 'pie', 'girl', 'boy'];
const CONS = 'bcdfghjklmnpqrstvwxz';
const VOW = 'aeiouy';
const LEET: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', s: '5' };

/** A small seeded generator (mulberry32), so the same room and seat always get the same name. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, list: readonly T[] | string): T => list[Math.floor(r() * list.length)] as T;
const between = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
/** Digits players put on the end: a birth year (two digits or four), or a number picked because the name was taken. */
const digits = (r: Rand) => {
  const k = r();
  if (k < 0.4) return String(between(r, 8, 16)).padStart(2, '0');
  if (k < 0.6) return String(between(r, 2008, 2016));
  if (k < 0.85) return String(between(r, 1, 99));
  return String(between(r, 100, 999));
};

/** A short "OG" name: four letters, mostly consonants (kxln, vrze), now and then one digit (z4ck). */
function og(r: Rand): string {
  const shape = pick<string>(r, ['cvcc', 'ccvc', 'cccc', 'cvcv', 'ccvc', 'cvcc']);
  let out = [...shape].map((c) => (c === 'c' ? pick<string>(r, CONS) : pick<string>(r, VOW))).join('');
  if (r() < 0.25) {
    const i = [...out].findIndex((c) => LEET[c]);
    if (i >= 0) out = out.slice(0, i) + LEET[out[i]] + out.slice(i + 1);
  }
  return out;
}

const MAKERS: [number, (r: Rand) => string][] = [
  [18, og],
  [20, (r) => pick<string>(r, FIRST) + (r() < 0.3 ? '_' : '') + digits(r)],
  [10, (r) => `big${pick<string>(r, FIRST)}fan${String(between(r, 1, 99))}`],
  [10, (r) => `${pick<string>(r, ['i', 'ilove'])}${pick<string>(r, THINGS)}${String(between(r, 1, 99))}`],
  [14, (r) => pick<string>(r, ADJ) + pick<string>(r, NOUN) + (r() < 0.35 ? String(between(r, 1, 99)) : '')],
  [10, (r) => `${pick<string>(r, ['its', 'lil', 'not', 'the', 'real'])}${r() < 0.4 ? '_' : ''}${pick<string>(r, [...FIRST, ...THINGS])}`],
  [10, (r) => `${pick<string>(r, SOFT)}_${pick<string>(r, SOFT_END)}`],
  [8, (r) => `${pick<string>(r, THINGS)}${pick<string>(r, ['gamer', 'pro', 'king', 'boss', 'man'])}${r() < 0.5 ? String(between(r, 1, 99)) : ''}`],
];
/** Numbers with a meaning children should not be handed (the name check catches the hateful ones). */
const CHEEKY = /69|420|666/;
const TOTAL = MAKERS.reduce((s, [w]) => s + w, 0);

/**
 * A player-like name for one bot seat. `seed` makes it repeatable (a room's code and the seat's number); `taken` holds
 * the names already at the table, in lower case, so no two seats share one.
 */
export function playerName(seed: string, taken: ReadonlySet<string> = new Set()): string {
  const r = rng(seed);
  for (let tries = 0; tries < 40; tries++) {
    let roll = r() * TOTAL;
    const make = MAKERS.find(([w]) => (roll -= w) < 0)?.[1] ?? og;
    const name = make(r);
    if (name.length < 3 || name.length > PLAYER_NAME_MAX) continue;
    if (taken.has(name.toLowerCase()) || isInappropriateName(name) || CHEEKY.test(name)) continue;
    return name;
  }
  return `player${between(r, 100, 999)}`;
}
