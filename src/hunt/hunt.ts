import type { Dictionary } from '../engine/dictionary';
import { rarityOf } from '../engine/rarity';
import { basePoints } from '../engine/scoring';
import { EVERYDAY } from './everyday';
import { brokenRule, rulePool } from './rules';
import type { Rule, RuleContext } from './rules';

/**
 * The Daily Hunt: a turn-based word battle. The sheep fights one predator after another; each word it types is an
 * attack, and the predator strikes back every turn. Predators bring rules the words must follow, more and harder ones
 * the further the sheep gets, until it is caught. Everything here is pure and seeded: the same day gives everyone the
 * same predators and the same rules.
 */

export type PredatorKind = 'wolf' | 'fox' | 'lynx' | 'bear' | 'eagle' | 'shadow';

export interface Predator {
  kind: PredatorKind;
  name: string;
  /** 1 for the first predator of the run. */
  level: number;
  boss: boolean;
  maxHp: number;
  hp: number;
  /** Damage it deals each time it strikes. */
  attack: number;
  rules: Rule[];
  /** Brought out when its health first drops to half or below (from the second predator on). */
  reserve: Rule | null;
  enraged: boolean;
  /**
   * For each of its rules (the reserve too), by rule id: a friendly word that obeys it and one that breaks it, for the
   * rule cards (plan v7 Part 4.2). Drawn after the rules from a stream of their own, so the rules never change.
   */
  examples: Record<string, Example>;
}

/** A word that obeys a rule and one that breaks it. For the chain rules before a first word: "apple then eagle". */
export interface Example { yes: string; no: string }

/** One mark per turn, for the share grid. */
export type Mark = 'hit' | 'crit' | 'broke' | 'timeout' | 'item';

/** The bag: the same few items for everyone, once per hunt. Using one takes the sheep's turn. */
export type ItemId = 'milk' | 'bell' | 'pepper';
export const ITEMS: Record<ItemId, { name: string; about: string; count: number }> = {
  milk: { name: 'Warm Milk', about: 'Restores 30 HP.', count: 2 },
  bell: { name: 'Hint Bell', about: 'Rings out a word that obeys every rule.', count: 1 },
  pepper: { name: 'Spicy Pepper', about: 'Your next word hits twice as hard.', count: 1 },
};
export const MILK_HEAL = 30;

/** Each predator's signature strike, for the battle text. */
export const MOVES: Record<PredatorKind, string> = {
  wolf: 'FROST FANG', fox: 'SLY SNAP', lynx: 'POUNCE', bear: 'BIG MAUL', eagle: 'TALON DIVE', shadow: 'NIGHT HOWL',
};

export interface Run {
  seed: string;
  /** The predator being fought (index 0 is the first). */
  index: number;
  predator: Predator;
  hp: number;
  maxHp: number;
  used: string[];
  prev: string | null;
  damage: number;
  defeated: number;
  marks: Mark[];
  best: { word: string; damage: number } | null;
  over: boolean;
  /** The sheep grows a level for each predator it beats (from Lv5), with more health each time. */
  level: number;
  items: Record<ItemId, number>;
  /** A Spicy Pepper is waiting for the next word. */
  peppered: boolean;
  /** The sheep walked home after a boss fainted (plan v7 Part 5.7). */
  walkedHome?: boolean;
}

export type Outcome =
  | { kind: 'invalid'; reason: 'format' | 'short' | 'notWord' | 'used' }
  | { kind: 'broke'; rule: Rule; counter: number; hp: number; dead: boolean }
  | { kind: 'timeout'; counter: number; hp: number; dead: boolean }
  | {
    kind: 'hit'; word: string; damage: number; crit: boolean; predatorHp: number; defeated: boolean;
    /** A new rule the predator brings now that it is hurt. */
    enraged: Rule | null;
    counter: number; hp: number; dead: boolean;
  }
  | { kind: 'item'; item: ItemId; heal: number; hint: string | null; counter: number; hp: number; dead: boolean };

export const PLAYER_HP = 100;
export const START_LEVEL = 5;
/** Max HP gained each level. */
export const HP_PER_LEVEL = 6;
export const HEAL_ON_WIN = 25;
const MIN_LETTERS = 3;
/** Fewer words than this left under a predator's rules and its chain rules give way for the turn. */
const VIABLE = 3;
/** A rule set must leave at least this many words in the dictionary, or it is drawn again. */
const FEASIBLE = 250;

const NAMES: Record<PredatorKind, string> = {
  wolf: 'Grey Wolf', fox: 'Red Fox', lynx: 'Lynx', bear: 'Polar Bear', eagle: 'Golden Eagle', shadow: 'Shadow Wolf',
};
const ORDER: PredatorKind[] = ['fox', 'wolf', 'lynx', 'eagle', 'bear'];
/** Each animal fights a little differently: the bear is tough but slow to strike, the eagle frail but sharp. */
const BUILD: Record<PredatorKind, { hp: number; attack: number }> = {
  wolf: { hp: 1, attack: 1 }, fox: { hp: 0.9, attack: 1 }, lynx: { hp: 1, attack: 1.1 },
  bear: { hp: 1.25, attack: 0.85 }, eagle: { hp: 0.85, attack: 1.2 }, shadow: { hp: 1.4, attack: 1 },
};

/** Seconds the sheep has to answer: 20 against the first predator, a second less for each one after, never under 10. */
export function turnSeconds(index: number): number {
  return Math.max(10, 20 - index);
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

// ---------- the dictionary under a set of rules ----------
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
function* allWords(dict: Dictionary): Generator<string> {
  for (const l of LETTERS) yield* dict.startingWith(l);
}

/** How many dictionary words obey `rules` (ignoring the chain rules), stopping once `enough` are found. */
export function countWords(dict: Dictionary, rules: readonly Rule[], enough = Infinity): number {
  const fixed = rules.filter((r) => !r.usesPrev);
  const ctx: RuleContext = { prev: null };
  let n = 0;
  for (const w of allWords(dict)) {
    if (w.length >= MIN_LETTERS && !brokenRule(w, fixed, ctx) && ++n >= enough) break;
  }
  return n;
}

/**
 * The rules in force for the sheep's next word. The chain rules (start letter, length) give way for one turn when
 * they would leave fewer than three unused words, so the sheep can never be trapped by its own last word.
 */
export function activeRules(run: Run, dict: Dictionary): { rules: Rule[]; relaxed: Rule[] } {
  const all = run.predator.rules;
  const chained = all.filter((r) => r.usesPrev);
  if (!run.prev || !chained.length) return { rules: all, relaxed: [] };
  const ctx: RuleContext = { prev: run.prev };
  const used = new Set(run.used);
  const pool = all.some((r) => r.id === 'chain') ? dict.startingWith(run.prev[run.prev.length - 1]) : allWords(dict);
  let n = 0;
  for (const w of pool) {
    if (w.length >= MIN_LETTERS && !used.has(w) && !brokenRule(w, all, ctx) && ++n >= VIABLE) return { rules: all, relaxed: [] };
  }
  return { rules: all.filter((r) => !r.usesPrev), relaxed: chained };
}

// ---------- predators ----------
/** The index-th predator of the day's run. Deterministic for a seed and a word list. */
export function predatorAt(dict: Dictionary, seed: string, index: number): Predator {
  const r = rng(`${seed}:${index}`);
  const boss = index > 0 && (index + 1) % 5 === 0;
  const kind: PredatorKind = boss ? 'shadow' : ORDER[(index + Math.floor(r() * ORDER.length)) % ORDER.length];
  // How many rules it brings: one for the first two, then two, then three from the fifth on.
  const ruleCount = index < 2 ? 1 : index < 4 ? 2 : 3;
  const pool = rulePool(index);
  // Early predators only use easy and medium rules; hard ones appear from the third.
  const maxDiff = index < 2 ? 1 : index < 4 ? 2 : 3;
  let rules: Rule[] = [];
  let reserve: Rule | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const picked: Rule[] = [];
    const groups = new Set<string>();
    const candidates = pool.filter((p) => p.difficulty <= maxDiff);
    while (picked.length < ruleCount + (index >= 1 ? 1 : 0) && candidates.length) {
      const c = candidates.splice(Math.floor(r() * candidates.length), 1)[0];
      if (groups.has(c.group)) continue;
      groups.add(c.group);
      picked.push(c);
    }
    const main = picked.slice(0, ruleCount);
    const extra = index >= 1 ? picked[ruleCount] ?? null : null;
    if (countWords(dict, extra ? [...main, extra] : main, FEASIBLE) >= FEASIBLE) {
      rules = main;
      reserve = extra;
      break;
    }
  }
  // Should never happen with a real word list; a predator with no rules is still a fair fight.
  const build = BUILD[kind];
  const maxHp = Math.round((36 + 16 * index) * build.hp);
  const attack = Math.round((7 + 2 * index + (boss ? 3 : 0) + Math.floor(r() * 2)) * build.attack);
  // The examples come last, from their own stream, so drawing them never changes the pack.
  const exSeed = `${seed}:${index}:ex`;
  const examples: Record<string, Example> = {};
  for (const rule of rules) examples[rule.id] = exampleWords(dict, rule, exSeed, { together: rules });
  if (reserve) examples[reserve.id] = exampleWords(dict, reserve, exSeed, { together: [...rules, reserve] });
  return { kind, name: NAMES[kind], level: index + 1, boss, maxHp, hp: maxHp, attack, rules, reserve, enraged: false, examples };
}

/**
 * Starts a run. `opts.drowsy` is reserved for the drowsy fox (plan v7 Part 7, not approved): it exists so the signature
 * never changes again, and does nothing.
 */
export function startRun(dict: Dictionary, seed: string, _opts: { drowsy?: boolean } = {}): Run {
  return {
    seed, index: 0, predator: predatorAt(dict, seed, 0), hp: PLAYER_HP, maxHp: PLAYER_HP,
    used: [], prev: null, damage: 0, defeated: 0, marks: [], best: null, over: false,
    level: START_LEVEL, items: { milk: ITEMS.milk.count, bell: ITEMS.bell.count, pepper: ITEMS.pepper.count }, peppered: false,
  };
}

/** The seed of a day's hunt: everyone gets the same one. */
export function dailySeed(dateKey: string): string {
  return `hunt:${dateKey}`;
}

/** Damage a word deals: its points doubled, plus 3 for each rule it had to obey; rare words are critical hits (x1.5). */
export function damageFor(word: string, ruleCount: number): { damage: number; crit: boolean } {
  const crit = rarityOf(word) === 'rare';
  const raw = basePoints(word) * 2 + 3 * ruleCount;
  return { damage: Math.round(raw * (crit ? 1.5 : 1)), crit };
}

function strike(run: Run, amount: number): { hp: number; dead: boolean } {
  const hp = Math.max(0, run.hp - amount);
  return { hp, dead: hp === 0 };
}

/** The sheep attacks with a word. Invalid input changes nothing; a broken rule wastes the turn. */
export function attack(run: Run, dict: Dictionary, raw: string): { run: Run; outcome: Outcome } {
  const word = raw.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) return { run, outcome: { kind: 'invalid', reason: 'format' } };
  if (word.length < MIN_LETTERS) return { run, outcome: { kind: 'invalid', reason: 'short' } };
  if (!dict.has(word)) return { run, outcome: { kind: 'invalid', reason: 'notWord' } };
  if (run.used.includes(word)) return { run, outcome: { kind: 'invalid', reason: 'used' } };

  const { rules } = activeRules(run, dict);
  const broke = brokenRule(word, rules, { prev: run.prev });
  if (broke) {
    const counter = run.predator.attack;
    const s = strike(run, counter);
    return {
      run: { ...run, hp: s.hp, over: s.dead, marks: [...run.marks, 'broke'] },
      outcome: { kind: 'broke', rule: broke, counter, hp: s.hp, dead: s.dead },
    };
  }

  const base = damageFor(word, rules.length);
  const damage = run.peppered ? base.damage * 2 : base.damage;
  const crit = base.crit;
  const p = run.predator;
  const predatorHp = Math.max(0, p.hp - damage);
  const defeated = predatorHp === 0;
  // Hurt to half or below for the first time: the predator brings its reserve rule.
  const enraged = !defeated && !p.enraged && p.reserve && predatorHp <= p.maxHp / 2 ? p.reserve : null;
  const predator: Predator = {
    ...p, hp: predatorHp,
    rules: enraged ? [...p.rules, enraged] : p.rules,
    reserve: enraged ? null : p.reserve,
    enraged: p.enraged || !!enraged,
  };
  const counter = defeated ? 0 : p.attack;
  const s = strike(run, counter);
  const best = !run.best || damage > run.best.damage ? { word, damage } : run.best;
  return {
    run: {
      ...run, predator, hp: s.hp, over: s.dead, used: [...run.used, word], prev: word, best,
      damage: run.damage + damage, defeated: run.defeated + (defeated ? 1 : 0), marks: [...run.marks, crit ? 'crit' : 'hit'], peppered: false,
    },
    outcome: { kind: 'hit', word, damage, crit, predatorHp, defeated, enraged, counter, hp: s.hp, dead: s.dead },
  };
}

/** The clock ran out: the predator gets a free, harder strike (one and a half times its attack). */
export function timeOut(run: Run): { run: Run; outcome: Outcome } {
  const counter = Math.round(run.predator.attack * 1.5);
  const s = strike(run, counter);
  return {
    run: { ...run, hp: s.hp, over: s.dead, marks: [...run.marks, 'timeout'] },
    outcome: { kind: 'timeout', counter, hp: s.hp, dead: s.dead },
  };
}

/** After a win: the next predator steps up and the sheep recovers a little. The chain starts fresh. */
export function nextPredator(run: Run, dict: Dictionary): Run {
  const index = run.index + 1;
  const maxHp = run.maxHp + HP_PER_LEVEL;
  return {
    ...run, index, predator: predatorAt(dict, run.seed, index), level: run.level + 1, maxHp,
    hp: Math.min(maxHp, run.hp + HP_PER_LEVEL + HEAL_ON_WIN), prev: null,
  };
}

/** A word that obeys every rule in force and has not been used: what the Hint Bell rings. Deterministic per turn. */
export function hintWord(run: Run, dict: Dictionary): string | null {
  const { rules } = activeRules(run, dict);
  const used = new Set(run.used);
  const ctx: RuleContext = { prev: run.prev };
  const r = rng(`${run.seed}:hint:${run.used.length}`);
  const start = run.prev && rules.some((x) => x.id === 'chain') ? run.prev[run.prev.length - 1] : LETTERS[Math.floor(r() * 26)];
  // Prefer an everyday word of five to eight letters, so the hint is one the player knows.
  const friendly = (w: string) => w.length >= 5 && w.length <= 8 && rarityOf(w) !== 'rare';
  let fallback: string | null = null;
  for (let k = 0; k < 26; k++) {
    const letter = rules.some((x) => x.id === 'chain') && run.prev ? start : LETTERS[(LETTERS.indexOf(start) + k) % 26];
    const pool = dict.startingWith(letter);
    const offset = Math.floor(r() * Math.max(1, pool.length));
    for (let i = 0; i < pool.length; i++) {
      const w = pool[(offset + i) % pool.length];
      if (w.length < MIN_LETTERS || used.has(w) || brokenRule(w, rules, ctx)) continue;
      if (friendly(w)) return w;
      fallback ??= w;
    }
    if (rules.some((x) => x.id === 'chain') && run.prev) break;
  }
  return fallback;
}

/** The sheep uses an item from the bag; it takes the turn, so the predator strikes after. */
export function applyItem(run: Run, dict: Dictionary, item: ItemId): { run: Run; outcome: Outcome } | null {
  if (run.items[item] <= 0 || run.over) return null;
  const items = { ...run.items, [item]: run.items[item] - 1 };
  const heal = item === 'milk' ? Math.min(MILK_HEAL, run.maxHp - run.hp) : 0;
  const hint = item === 'bell' ? hintWord(run, dict) : null;
  const counter = run.predator.attack;
  const healed = run.hp + heal;
  const hp = Math.max(0, healed - counter);
  return {
    run: { ...run, items, hp, over: hp === 0, peppered: run.peppered || item === 'pepper', marks: [...run.marks, 'item'] },
    outcome: { kind: 'item', item, heal, hint, counter, hp, dead: hp === 0 },
  };
}

// ---------- teaching (plan v7 Part 4.2 and 4.3) ----------
/** An everyday word of five to eight letters: what a rule card and the Hint Bell show. */
export function isFriendly(w: string): boolean {
  return w.length >= 5 && w.length <= 8 && rarityOf(w) !== 'rare';
}

/** The chain rules before a first word: a fixed pair to show how they work. */
const CHAIN_EXAMPLES: Record<string, Example> = {
  chain: { yes: 'apple then eagle', no: 'apple then tiger' },
  longer: { yes: 'sheep then meadow', no: 'meadow then sheep' },
  newstart: { yes: 'sheep then wool', no: 'sheep then snow' },
};
/**
 * How many words that obey the rule the search for a "yes" word obeying every rule together looks at before settling
 * for the rule alone. The plan says 400; rule sets of three leave so few everyday words that 400 missed about one in
 * thirty, so the search goes further (it stops at the first fit, and only hard sets go deep).
 */
const TOGETHER_CANDIDATES = 4000;

/** Words from a seeded starting point: the everyday list first, then the whole list letter by letter. */
function* seededWords(dict: Dictionary, r: () => number): Generator<string> {
  const off = Math.floor(r() * EVERYDAY.length);
  for (let i = 0; i < EVERYDAY.length; i++) {
    const w = EVERYDAY[(off + i) % EVERYDAY.length];
    if (dict.has(w)) yield w;
  }
  const start = Math.floor(r() * 26);
  for (let k = 0; k < 26; k++) {
    const pool = dict.startingWith(LETTERS[(start + k) % 26]);
    const offset = Math.floor(r() * Math.max(1, pool.length));
    for (let i = 0; i < pool.length; i++) yield pool[(offset + i) % pool.length];
  }
}

const EVERYDAY_SET = new Set(EVERYDAY);
/** A rule card's YES word: five to eight letters, and everyday or friendly. */
export function isExampleYes(w: string): boolean {
  return w.length >= 5 && w.length <= 8 && (EVERYDAY_SET.has(w) || rarityOf(w) !== 'rare');
}
/** A rule card's NO word: three to eight letters (a 5+ rule's NO word is short), everyday or friendly. */
export function isExampleNo(w: string): boolean {
  return w.length >= MIN_LETTERS && w.length <= 8 && (EVERYDAY_SET.has(w) || rarityOf(w) !== 'rare');
}

/**
 * A YES word that obeys `rule` and a NO word that breaks it, deterministic for the seed, from the everyday list when
 * one fits. When `together` is given, the YES word obeys all of those rules at once if one is found, so it is a word
 * the player could actually type. The chain rules use `prev` when there is one, else a fixed illustration.
 */
export function exampleWords(dict: Dictionary, rule: Rule, seed: string, opts: { together?: readonly Rule[]; prev?: string | null } = {}): Example {
  const prev = opts.prev ?? null;
  if (rule.usesPrev && !prev) return CHAIN_EXAMPLES[rule.id] ?? { yes: '', no: '' };
  const ctx: RuleContext = { prev };
  const together = opts.together ?? [rule];
  const r = rng(`${seed}:${rule.id}`);
  let yes: string | null = null, yesAlone: string | null = null, no: string | null = null;
  let seen = 0;
  for (const w of seededWords(dict, r)) {
    if (w === prev) continue;
    if (rule.test(w, ctx)) {
      if (!isExampleYes(w)) continue;
      if (!yes && seen < TOGETHER_CANDIDATES) {
        seen++;
        if (!brokenRule(w, together, ctx)) yes = w;
      }
      yesAlone ??= w;
    } else if (!no && isExampleNo(w)) no = w;
    if ((yes || (yesAlone && seen >= TOGETHER_CANDIDATES)) && no) break;
  }
  return { yes: yes ?? yesAlone ?? '', no: no ?? '' };
}

/** What the word being typed would do (plan v7 Part 4.2): the rule it breaks, whether it is short, used or a word. */
export function checkTyped(run: Run, dict: Dictionary, typed: string): { broken: Rule | null; tooShort: boolean; used: boolean; known: boolean | null } {
  const w = typed.trim().toLowerCase();
  const tooShort = w.length < MIN_LETTERS;
  const broken = w ? brokenRule(w, activeRules(run, dict).rules, { prev: run.prev }) : null;
  return { broken, tooShort, used: run.used.includes(w), known: tooShort ? null : dict.has(w) };
}

/** How a run-ending outcome ended it: an item or a hit that ends the run counts as the predator's strikes. */
export function causeOf(outcome: Outcome): 'timeout' | 'broke' | 'hits' {
  return outcome.kind === 'timeout' ? 'timeout' : outcome.kind === 'broke' ? 'broke' : 'hits';
}

/**
 * For the death screen, from the run as it was before the killing turn: a word that would have worked then (an
 * everyday one when there is one, else what the Hint Bell would have rung), and 'milk' when a Warm Milk was left that would have lasted out the predator's strike.
 */
export function lastWords(before: Run, dict: Dictionary): { word: string | null; itemHelp: 'milk' | null } {
  const heal = Math.min(MILK_HEAL, before.maxHp - before.hp);
  const milk = before.items.milk > 0 && before.hp + heal > before.predator.attack;
  return { word: everydayWord(before, dict) ?? hintWord(before, dict), itemHelp: milk ? 'milk' : null };
}

/**
 * An everyday word that obeys every rule in force and has not been used, or null. The death screen prefers it to the
 * Hint Bell's word, which is chosen by letters and can be one nobody knows. Deterministic per turn.
 */
export function everydayWord(run: Run, dict: Dictionary): string | null {
  const { rules } = activeRules(run, dict);
  const used = new Set(run.used);
  const ctx: RuleContext = { prev: run.prev };
  const off = Math.floor(rng(`${run.seed}:everyday:${run.used.length}`)() * EVERYDAY.length);
  for (let i = 0; i < EVERYDAY.length; i++) {
    const w = EVERYDAY[(off + i) % EVERYDAY.length];
    if (w.length >= MIN_LETTERS && !used.has(w) && dict.has(w) && !brokenRule(w, rules, ctx)) return w;
  }
  return null;
}

/** Whether the run is in the pause after a boss fainted, when the sheep may walk home. */
export function canWalkHome(run: Run): boolean {
  return !run.over && run.predator.boss && run.predator.hp === 0;
}

/** Ends the run on a win after a boss (plan v7 Part 5.7). `defeated` is unchanged, so stopping never adds to a record. */
export function walkHome(run: Run): Run {
  if (!canWalkHome(run)) return run;
  return { ...run, over: true, walkedHome: true };
}
