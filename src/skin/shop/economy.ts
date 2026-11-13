import { CATALOG, DEFAULTS, itemById } from './catalog';
import type { Kind, Rarity } from './catalog';
import { freshPity, rollSack, sackComplete } from './roll';
import type { Pity } from './roll';
import { SACK, SACK_IDS } from './sacks';
import type { SackId } from './sacks';

/**
 * Wool Coins, XP and the Trading Post's inventory, kept in this browser (`sap:barn`). The pure functions here take a
 * wallet and return a new one, so every rule is tested without a browser; `store.ts` holds the live copy.
 *
 * Rules that keep it fair (docs/plans/SHOP.md, docs/PLAN_TRADING_POST_V2.md): Wool Coins are earned by playing and
 * spent only on Feed Sacks of cosmetics; a day's earnings from games stop at DAILY_CAP (XP keeps counting); a game pays
 * once; nothing is ever taken away. Sacks show their real odds and have pity. Golden Bells, a second currency earned in
 * small amounts, buy only the Bell Shelf's items: never a sack, and the two never convert. Mission items are earned
 * only by playing.
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
  /** Pity counters, one pair per sack. */
  pity: Record<SackId, Pity>;
  /** The longest Counting Sheep streak this player has reached, for the streak missions. */
  bestStreak: number;
  /**
   * The account's wallet only: the UTC day the server last let `bestStreak` rise. The dream is played in the browser,
   * so its streak is the browser's word; the server lets it rise one night for each day gone by (server/barn/service.ts).
   */
  streakDay: string;
  /** Golden Bells: earned for levels, milestones and dream streaks; spent only on the Bell Shelf. */
  bells: number;
  /** The best streak already paid Golden Bells for (a multiple of 7). */
  bellStreak: number;
}

/** What one opened sack gave: handed to the machine that reveals it. Not kept. */
export interface SackEntry { sack: SackId; itemId: string; tier: Rarity; duplicate: boolean; refund: number; at: number }
/** Golden Bells: per level reached, per milestone, per 7 nights of the best dream streak. */
export const BELLS = { level: 5, achievement: 10, streak7: 20 } as const;
export const freshPities = (): Record<SackId, Pity> => ({ bomb: freshPity(), blast: freshPity(), tick: freshPity() });

export const DAILY_CAP = 300;
const MAX_PAID = 60;
const MAX_WORDS = 20_000;

export const freshWallet = (): Wallet => ({
  coins: 0, xp: 0, owned: CATALOG.filter((i) => i.source === 'free').map((i) => i.id), equipped: { ...DEFAULTS },
  day: '', earnedToday: 0, paid: [], words: [], achieved: [],
  pity: freshPities(), bestStreak: 0, streakDay: '', bells: 0, bellStreak: 0,
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
  const pities = r.pity && typeof r.pity === 'object' ? (r.pity as Record<string, Partial<Pity> | undefined>) : {};
  for (const id of SACK_IDS) {
    const p = pities[id] && typeof pities[id] === 'object' ? pities[id]! : {};
    w.pity[id] = { sinceRare: Math.min(num(p.sinceRare), SACK.pity.rare - 1), sinceLegendary: Math.min(num(p.sinceLegendary), SACK.pity.legendary - 1) };
  }
  w.bestStreak = Math.min(num(r.bestStreak), 3660);
  w.streakDay = typeof r.streakDay === 'string' && /^\d{4}-\d\d-\d\d$/.test(r.streakDay) ? r.streakDay : '';
  w.bells = num(r.bells);
  w.bellStreak = num(r.bellStreak);
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

export interface Achievement { id: string; label: string; coins: number; need: number; have(w: Wallet): number; done(w: Wallet): boolean }
const RARE = /^[xzqj]/;
const words = (w: Wallet) => w.words.length;
const rareWords = (w: Wallet) => w.words.filter((x) => RARE.test(x)).length;
const ach = (id: string, label: string, coins: number, need: number, have: (w: Wallet) => number): Achievement =>
  ({ id, label, coins, need, have, done: (w) => have(w) >= need });
/** Coin milestones (the Missions tab lists them with their progress). */
export const ACHIEVEMENTS: Achievement[] = [
  ach('words-50', '50 different words', 25, 50, words),
  ach('words-250', '250 different words', 75, 250, words),
  ach('words-1000', '1,000 different words', 200, 1000, words),
  ach('words-5000', '5,000 different words', 500, 5000, words),
  ach('rare-10', '10 words starting with X, Z, Q or J', 50, 10, rareWords),
  ach('rare-25', '25 words starting with X, Z, Q or J', 120, 25, rareWords),
];

// ---------------------------------------------------------------- missions

/** A mission gives its item for good once `have` reaches `need`. Earned only by playing, never bought or rolled. */
export interface Mission { id: string; itemId: string; label: string; need: number; have(w: Wallet): number }
export const MISSIONS: Mission[] = [
  { id: 'streak-7', itemId: 'bomb-aurora', label: 'Count sheep 7 nights in a row', need: 7, have: (w) => w.bestStreak },
  { id: 'streak-30', itemId: 'blast-starlight', label: 'Count sheep 30 nights in a row', need: 30, have: (w) => w.bestStreak },
  { id: 'streak-100', itemId: 'tick-lullaby', label: 'Count sheep 100 nights in a row', need: 100, have: (w) => w.bestStreak },
];
export const missionFor = (itemId: string) => MISSIONS.find((m) => m.itemId === itemId);

/** Gives every mission item the wallet has earned and does not own yet. Mutates `w`; returns the ids given. */
function grantMissions(w: Wallet): string[] {
  const granted = MISSIONS.filter((m) => !w.owned.includes(m.itemId) && m.have(w) >= m.need).map((m) => m.itemId);
  w.owned.push(...granted);
  return granted;
}

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
  /** Mission items this game finished, by id. */
  items: string[];
  /** Golden Bells this game brought (levels and milestones), usually 0. */
  bells: number;
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
  const none: Payout = { wallet: w, lines: [], coins: 0, xp: 0, levelUp: null, achievements: [], capped: false, items: [], bells: 0 };
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

  const items = grantMissions(w);
  const bells = (after - before) * BELLS.level + reached.length * BELLS.achievement;
  w.bells += bells;
  w.paid = [...w.paid, id].slice(-MAX_PAID);
  const newTitle = TITLES.find(([l]) => l > before && l <= after)?.[1];
  return {
    wallet: w, lines: out, coins: w.coins - startCoins, xp: raw,
    levelUp: after > before ? { from: before, to: after, title: newTitle } : null,
    achievements: reached.map((a) => a.label), capped, items, bells,
  };
}

// ---------------------------------------------------------------- the Bell Shelf

export type BuyResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'unknown' | 'owned' | 'not_for_sale' | 'short' | 'offline' };

/** Buys a Bell Shelf item for its price in Golden Bells. Nothing else is for sale: Wool Coins only open sacks. */
export function buy(wallet: Wallet, id: string): BuyResult {
  const w = normalise(wallet);
  const item = itemById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (w.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (item.source !== 'bells' || !item.price) return { ok: false, reason: 'not_for_sale' };
  if (w.bells < item.price) return { ok: false, reason: 'short' };
  w.bells -= item.price;
  w.owned.push(id);
  return { ok: true, wallet: w };
}

// ---------------------------------------------------------------- Feed Sacks

export type SackResult = { ok: true; wallet: Wallet; entry: SackEntry } | { ok: false; reason: 'short' | 'complete' };

/**
 * Opens one sack of the given kind for SACK.price Wool Coins. The roll, the pity counters and the
 * item or its refund all land in the one wallet returned, before any animation: a page closed
 * mid-reveal keeps exactly this result.
 */
export function openSack(wallet: Wallet, sack: SackId, rand: () => number, at: number): SackResult {
  const w = normalise(wallet);
  if (sackComplete(sack, w.owned)) return { ok: false, reason: 'complete' };
  if (w.coins < SACK.price) return { ok: false, reason: 'short' };
  const roll = rollSack(sack, w.owned, w.pity[sack], rand);
  if (!roll) return { ok: false, reason: 'complete' };
  w.coins -= SACK.price;
  if (roll.duplicate) w.coins += roll.refund;
  else w.owned.push(roll.itemId);
  w.pity[sack] = roll.counters;
  return { ok: true, wallet: w, entry: { sack, itemId: roll.itemId, tier: roll.tier, duplicate: roll.duplicate, refund: roll.refund, at } };
}

export function equip(wallet: Wallet, id: string): Wallet {
  const w = normalise(wallet);
  const item = itemById(id);
  if (item && w.owned.includes(id)) w.equipped[item.kind] = id;
  return w;
}

/**
 * Records the player's best Counting Sheep streak (it only goes up), gives every mission item now earned, and pays
 * BELLS.streak7 Golden Bells for each 7 nights of it not paid before. Never takes anything back.
 */
export function grantStreakItems(wallet: Wallet, bestStreak: number): { wallet: Wallet; granted: string[]; bells: number; changed: boolean } {
  const w = normalise(wallet);
  const best = Math.max(0, Math.min(3660, Math.floor(bestStreak)));
  const raised = best > w.bestStreak;
  if (raised) w.bestStreak = best;
  const granted = grantMissions(w);
  const weeks = Math.floor(w.bestStreak / 7) * 7;
  const bells = weeks > w.bellStreak ? ((weeks - w.bellStreak) / 7) * BELLS.streak7 : 0;
  if (bells) { w.bells += bells; w.bellStreak = weeks; }
  return { wallet: w, granted, bells, changed: raised || granted.length > 0 || bells > 0 };
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
    bestStreak: Math.max(x.bestStreak, y.bestStreak), streakDay: x.streakDay > y.streakDay ? x.streakDay : y.streakDay,
    bells: Math.max(x.bells, y.bells), bellStreak: Math.max(x.bellStreak, y.bellStreak),
    pity: Object.fromEntries(SACK_IDS.map((id) => [id, { sinceRare: Math.max(x.pity[id].sinceRare, y.pity[id].sinceRare), sinceLegendary: Math.max(x.pity[id].sinceLegendary, y.pity[id].sinceLegendary) }])),
  });
}
