import { CATALOG, DEFAULTS, itemById } from './catalog';
import type { Kind } from './catalog';

/**
 * Wool Coins, XP and the Barn Bazaar's inventory, kept in this browser (`sap:barn`). The pure functions here take a
 * wallet and return a new one, so every rule is tested without a browser; `store.ts` holds the live copy.
 *
 * Rules that keep it fair (docs/plans/SHOP.md): coins only buy cosmetics; a day's earnings from games stop at
 * DAILY_CAP (XP keeps counting); a game pays once; nothing is ever taken away; nothing is random.
 */
export interface Wallet {
  coins: number;
  xp: number;
  owned: string[];
  equipped: Record<Kind, string>;
  /** The local day `earnedToday` counts for (YYYY-MM-DD). */
  day: string;
  earnedToday: number;
  /** Games already paid (their seeds), newest last, so a reward can't be collected twice. */
  paid: string[];
  /** Every different word this player has played at a table, lowercase. */
  words: string[];
  /** Achievement ids already given. */
  achieved: string[];
}

export const DAILY_CAP = 300;
const MAX_PAID = 60;
const MAX_WORDS = 20_000;

export const freshWallet = (): Wallet => ({
  coins: 0, xp: 0, owned: CATALOG.filter((i) => i.source === 'free').map((i) => i.id), equipped: { ...DEFAULTS },
  day: '', earnedToday: 0, paid: [], words: [], achieved: [],
});

/** A stored wallet made safe: wrong or missing fields fall back to the defaults, unknown items are dropped. */
export function normalise(raw: unknown): Wallet {
  const w = freshWallet();
  if (!raw || typeof raw !== 'object') return w;
  const r = raw as Partial<Wallet>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
  w.coins = num(r.coins);
  w.xp = num(r.xp);
  w.owned = [...new Set([...w.owned, ...strs(r.owned).filter((id) => itemById(id))])];
  for (const k of Object.keys(DEFAULTS) as Kind[]) {
    const id = r.equipped && typeof r.equipped === 'object' ? (r.equipped as Record<string, unknown>)[k] : undefined;
    if (typeof id === 'string' && w.owned.includes(id) && itemById(id)?.kind === k) w.equipped[k] = id;
  }
  w.day = typeof r.day === 'string' ? r.day : '';
  w.earnedToday = num(r.earnedToday);
  w.paid = strs(r.paid).slice(-MAX_PAID);
  w.words = strs(r.words).slice(-MAX_WORDS);
  w.achieved = strs(r.achieved);
  return w;
}

// ---------------------------------------------------------------- levels

/** XP needed to reach `level` (level 1 needs none): 100, 300, 600, 1000, ... (100 more each level). */
export const xpForLevel = (level: number) => (50 * (level - 1) * level);
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return { level, into: xp - xpForLevel(level), need: xpForLevel(level + 1) - xpForLevel(level) };
}
/** Barn titles, by the level they arrive at. */
export const TITLES: [number, string][] = [
  [1, 'Lamb'], [3, 'Word Wrangler'], [5, 'Barnyard Bard'], [8, 'Fence Jumper'], [12, 'Shepherd of Words'], [20, 'Golden Fleece'],
];
export const titleFor = (level: number) => [...TITLES].reverse().find(([l]) => level >= l)![1];
/** Coins for reaching a level, paid once each time a level is reached. */
export const levelBonus = (level: number) => 25 * level;

// ---------------------------------------------------------------- achievements

export interface Achievement { id: string; label: string; coins: number; done(w: Wallet): boolean }
const RARE = /^[xzqj]/;
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'words-50', label: '50 different words', coins: 25, done: (w) => w.words.length >= 50 },
  { id: 'words-250', label: '250 different words', coins: 75, done: (w) => w.words.length >= 250 },
  { id: 'words-1000', label: '1,000 different words', coins: 200, done: (w) => w.words.length >= 1000 },
  { id: 'words-5000', label: '5,000 different words', coins: 500, done: (w) => w.words.length >= 5000 },
  { id: 'rare-10', label: '10 words starting with X, Z, Q or J', coins: 50, done: (w) => w.words.filter((x) => RARE.test(x)).length >= 10 },
  { id: 'rare-25', label: '25 words starting with X, Z, Q or J', coins: 120, done: (w) => w.words.filter((x) => RARE.test(x)).length >= 25 },
];

// ---------------------------------------------------------------- rewards

export interface Line { label: string; coins: number }
export interface Payout {
  wallet: Wallet;
  /** What was paid, line by line, for the results board. Empty if this game was already paid. */
  lines: Line[];
  coins: number;
  xp: number;
  levelUp: { from: number; to: number; title?: string } | null;
  /** Labels of achievements reached by this game. */
  achievements: string[];
  capped: boolean;
}

export type GameReward =
  | { mode: 'quick'; won: boolean; words: string[] }
  | { mode: 'practice'; score: number; words: string[] }
  | { mode: 'dream'; sheep: number; slept: boolean };

/** What a finished game pays before the daily cap. */
export function rewardLines(g: GameReward): Line[] {
  if (g.mode === 'quick') {
    const long = Math.min(10, g.words.filter((w) => w.length >= 7).length);
    return [
      { label: 'Finished the game', coins: 20 },
      ...(g.won ? [{ label: 'Last sheep standing', coins: 30 }] : []),
      ...(long ? [{ label: `${long} long word${long === 1 ? '' : 's'}`, coins: long * 2 }] : []),
    ].filter((l) => l.coins > 0);
  }
  if (g.mode === 'practice') {
    const c = Math.min(30, g.score);
    return c > 0 ? [{ label: `${g.score} words in the run`, coins: c }] : [];
  }
  return [
    ...(g.sheep > 0 ? [{ label: `${g.sheep} sheep counted`, coins: Math.min(30, g.sheep) }] : []),
    ...(g.slept ? [{ label: 'The farmer slept', coins: 20 }] : []),
  ];
}

/**
 * Pays a finished game once (by `id`), within the day's cap, adds its words to the log, and pays any level and
 * achievement bonuses it reached. Those bonuses are milestones, so they sit outside the daily cap.
 */
export function payGame(wallet: Wallet, id: string, g: GameReward, today: string): Payout {
  const w = normalise(wallet);
  const startCoins = w.coins;
  const none: Payout = { wallet: w, lines: [], coins: 0, xp: 0, levelUp: null, achievements: [], capped: false };
  if (!id || w.paid.includes(id)) return none;
  if (w.day !== today) { w.day = today; w.earnedToday = 0; }

  const lines = rewardLines(g);
  const raw = lines.reduce((n, l) => n + l.coins, 0);
  const room = Math.max(0, DAILY_CAP - w.earnedToday);
  const earned = Math.min(raw, room);
  const capped = earned < raw;
  const out: Line[] = [...lines];
  if (capped) out.push({ label: "Today's coin limit reached", coins: earned - raw });
  w.earnedToday += earned;
  w.coins += earned;

  const before = levelOf(w.xp).level;
  w.xp += raw;
  const after = levelOf(w.xp).level;
  let bonus = 0;
  for (let l = before + 1; l <= after; l++) bonus += levelBonus(l);
  if (bonus) { out.push({ label: `Reached level ${after}`, coins: bonus }); w.coins += bonus; }

  if (g.mode !== 'dream') {
    const seen = new Set(w.words);
    for (const word of g.words) { const k = word.toLowerCase(); if (!seen.has(k)) { seen.add(k); w.words.push(k); } }
    w.words = w.words.slice(-MAX_WORDS);
  }
  const reached = ACHIEVEMENTS.filter((a) => !w.achieved.includes(a.id) && a.done(w));
  for (const a of reached) { w.achieved.push(a.id); w.coins += a.coins; out.push({ label: a.label, coins: a.coins }); }

  w.paid = [...w.paid, id].slice(-MAX_PAID);
  const newTitle = TITLES.find(([l]) => l > before && l <= after)?.[1];
  return {
    wallet: w, lines: out, coins: w.coins - startCoins, xp: raw,
    levelUp: after > before ? { from: before, to: after, title: newTitle } : null,
    achievements: reached.map((a) => a.label), capped,
  };
}

// ---------------------------------------------------------------- the shop

export type BuyResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'unknown' | 'owned' | 'not_for_sale' | 'short' };

export function buy(wallet: Wallet, id: string): BuyResult {
  const w = normalise(wallet);
  const item = itemById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (w.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (item.source !== 'coins' || !item.price) return { ok: false, reason: 'not_for_sale' };
  if (w.coins < item.price) return { ok: false, reason: 'short' };
  w.coins -= item.price;
  w.owned.push(id);
  return { ok: true, wallet: w };
}

export function equip(wallet: Wallet, id: string): Wallet {
  const w = normalise(wallet);
  const item = itemById(id);
  if (item && w.owned.includes(id)) w.equipped[item.kind] = id;
  return w;
}

/** Gives every streak item the player's best Counting Sheep streak has earned. Never takes one back. */
export function grantStreakItems(wallet: Wallet, bestStreak: number): { wallet: Wallet; granted: string[] } {
  const w = normalise(wallet);
  const granted = CATALOG.filter((i) => i.source === 'streak' && (i.streak ?? Infinity) <= bestStreak && !w.owned.includes(i.id)).map((i) => i.id);
  w.owned.push(...granted);
  return { wallet: w, granted };
}

/** Two wallets made one (the save code): the larger of each count, every item and word and achievement from both. */
export function mergeWallets(a: Wallet, b: Wallet): Wallet {
  const x = normalise(a), y = normalise(b);
  const later = y.day > x.day ? y : x;
  return normalise({
    coins: Math.max(x.coins, y.coins), xp: Math.max(x.xp, y.xp),
    owned: [...new Set([...x.owned, ...y.owned])], equipped: later.equipped,
    day: later.day, earnedToday: later.earnedToday,
    paid: [...new Set([...x.paid, ...y.paid])], words: [...new Set([...x.words, ...y.words])],
    achieved: [...new Set([...x.achieved, ...y.achieved])],
  });
}
