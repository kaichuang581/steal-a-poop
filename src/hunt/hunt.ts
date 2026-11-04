import type { Dictionary } from '../engine/dictionary';
import { rarityOf } from '../engine/rarity';
import { basePoints } from '../engine/scoring';
import { brokenRule, rulePool } from './rules';
import type { Rule, RuleContext } from './rules';

/**
 * The Daily Hunt: a turn-based word battle. The sheep fights one predator after another; each word it types is an
 * attack, and the predator strikes back every turn. Predators bring rules the words must follow, more and harder ones
 * the further the sheep gets, until it is caught. Everything here is pure and seeded: the same day gives everyone the
 * same predators and the same rules.
 */

export type PredatorKind = 'wolf' | 'fox' | 'arctic' | 'coyote' | 'shadow';

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
}

/** One mark per turn, for the share grid. */
export type Mark = 'hit' | 'crit' | 'broke' | 'timeout';

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
  };

export const PLAYER_HP = 100;
export const HEAL_ON_WIN = 25;
const MIN_LETTERS = 3;
/** Fewer words than this left under a predator's rules and its chain rules give way for the turn. */
const VIABLE = 3;
/** A rule set must leave at least this many words in the dictionary, or it is drawn again. */
const FEASIBLE = 250;

const NAMES: Record<PredatorKind, string> = {
  wolf: 'Grey Wolf', fox: 'Red Fox', arctic: 'Snow Fox', coyote: 'Coyote', shadow: 'Shadow Wolf',
};
const ORDER: PredatorKind[] = ['wolf', 'fox', 'arctic', 'coyote'];

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
  const maxHp = Math.round((36 + 16 * index) * (boss ? 1.4 : 1));
  return {
    kind, name: NAMES[kind], level: index + 1, boss, maxHp, hp: maxHp,
    attack: 7 + 2 * index + (boss ? 3 : 0) + Math.floor(r() * 2), rules, reserve, enraged: false,
  };
}

export function startRun(dict: Dictionary, seed: string): Run {
  return {
    seed, index: 0, predator: predatorAt(dict, seed, 0), hp: PLAYER_HP, maxHp: PLAYER_HP,
    used: [], prev: null, damage: 0, defeated: 0, marks: [], best: null, over: false,
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

  const { damage, crit } = damageFor(word, rules.length);
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
      damage: run.damage + damage, defeated: run.defeated + (defeated ? 1 : 0), marks: [...run.marks, crit ? 'crit' : 'hit'],
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
  return { ...run, index, predator: predatorAt(dict, run.seed, index), hp: Math.min(run.maxHp, run.hp + HEAL_ON_WIN), prev: null };
}
