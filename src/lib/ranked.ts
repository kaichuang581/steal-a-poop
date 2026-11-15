/**
 * Ranked play: the ladder and the rating maths, shared by the game server (which keeps and changes ratings) and the
 * game (which shows them). Asked for by Brian, 2026-11-13: "give the ranked system an elo system in which people can
 * rankup, make 8 divisions of ranks for now, copying the valorant/brawl stars ranking system to an extent (different
 * names obviously just the structure)".
 *
 * The structure is theirs: eight ranks, the first seven split into divisions I, II and III of 100 points each, the
 * eighth open-ended at the top. The names were chosen by Brian on 2026-11-14 after several rounds ("for number one keep everything but replace frostfire with titan"): materials for the climb, then Titan, Eclipse and Zenith, the very top. A rating is one number, the points: it starts at 0 (Wood I)
 * and moves by Elo after every ranked game, each player compared with every other player at the table.
 *
 * Two things are added to plain Elo, both borrowed from those ladders so that playing moves a newcomer up:
 * - the bottom ranks soften a loss (LOSS_SHARE): nothing is lost in Wood, half in Stone, three quarters in
 *   Iron; from Gold up a loss counts in full;
 * - a rating never goes below 0.
 * These numbers are a first guess. Change them here; the server and the game both read this file.
 */
export const RANKED_START = 0;
export const DIVISION_POINTS = 100;
export const DIVISIONS = 3;
export const ELO_K = 32;
/** How wide a gap in points makes the stronger player ten times as likely to finish ahead. */
export const ELO_SCALE = 400;
/** Ranked tables: this many people at least, this many at most. No farm sheep. */
export const RANKED_MIN_PLAYERS = 2;
export const RANKED_MAX_PLAYERS = 4;

export interface Tier { id: string; name: string; /** The share of an Elo loss that is taken off, at this rank. */ lossShare: number }
export const TIERS: readonly Tier[] = [
  { id: 'wood', name: 'Wood', lossShare: 0 },
  { id: 'stone', name: 'Stone', lossShare: 0.5 },
  { id: 'iron', name: 'Iron', lossShare: 0.75 },
  { id: 'gold', name: 'Gold', lossShare: 1 },
  { id: 'crystal', name: 'Crystal', lossShare: 1 },
  { id: 'titan', name: 'Titan', lossShare: 1 },
  { id: 'eclipse', name: 'Eclipse', lossShare: 1 },
  { id: 'zenith', name: 'Zenith', lossShare: 1 },
];
const TOP = TIERS.length - 1;
/** Where the last rank starts: seven ranks of three divisions below it. */
export const TOP_FLOOR = TOP * DIVISIONS * DIVISION_POINTS;
const ROMAN = ['I', 'II', 'III'] as const;

export interface Rank {
  /** 0 (Wood) to 7 (Zenith). */
  tier: number;
  id: string;
  name: string;
  /** 1 to 3, the higher the better; null in the last rank, which has none. */
  division: 1 | 2 | 3 | null;
  /** "Gold II", "Zenith". */
  label: string;
  /** Points into this division (0 to 99), or above the last rank's floor. */
  points: number;
  /** Points still needed for the next division or rank; null in the last rank. */
  toNext: number | null;
  /** What comes next: "Gold III", "Crystal I"; null in the last rank. */
  next: string | null;
}

const clean = (rating: number) => (Number.isFinite(rating) ? Math.max(0, Math.round(rating)) : RANKED_START);
const labelAt = (step: number) => (step >= TOP * DIVISIONS ? TIERS[TOP].name : `${TIERS[Math.floor(step / DIVISIONS)].name} ${ROMAN[step % DIVISIONS]}`);

/** Where a rating stands on the ladder. */
export function rankOf(rating: number): Rank {
  const r = clean(rating);
  if (r >= TOP_FLOOR) return { tier: TOP, id: TIERS[TOP].id, name: TIERS[TOP].name, division: null, label: TIERS[TOP].name, points: r - TOP_FLOOR, toNext: null, next: null };
  const step = Math.floor(r / DIVISION_POINTS);
  const tier = Math.floor(step / DIVISIONS);
  const points = r - step * DIVISION_POINTS;
  return {
    tier, id: TIERS[tier].id, name: TIERS[tier].name, division: ((step % DIVISIONS) + 1) as 1 | 2 | 3, label: labelAt(step),
    points, toNext: DIVISION_POINTS - points, next: labelAt(step + 1),
  };
}

/** The chance, 0 to 1, that a player rated `a` finishes ahead of one rated `b`. */
export const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / ELO_SCALE));

export interface Placed { id: string; rating: number; /** 1 is first. Two players with the same place tied. */ place: number }
export interface RatingChange { before: number; after: number; delta: number; place: number }

/**
 * The new ratings after one ranked game. Every player is compared with every other: ahead of them scores 1, level 0.5,
 * behind 0, against what their ratings said to expect; the sum is scaled so a table of any size moves a player about
 * as much as a duel would (K, shared out over the opponents). A loss is then softened by the loser's rank, a rating
 * stops at 0, and finishing first always gains at least a point. One player alone changes nothing.
 */
export function ratingChanges(players: readonly Placed[]): Record<string, RatingChange> {
  const out: Record<string, RatingChange> = {};
  const n = players.length;
  for (const p of players) {
    const before = clean(p.rating);
    let sum = 0;
    for (const o of players) {
      if (o === p) continue;
      const score = p.place < o.place ? 1 : p.place === o.place ? 0.5 : 0;
      sum += score - expectedScore(before, clean(o.rating));
    }
    let delta = n > 1 ? (ELO_K / (n - 1)) * sum : 0;
    if (delta < 0) delta *= TIERS[rankOf(before).tier].lossShare;
    delta = Math.round(delta);
    const alone = players.every((o) => o === p || o.place !== p.place);
    if (n > 1 && p.place === 1 && alone && delta < 1) delta = 1;
    const after = Math.max(0, before + delta);
    out[p.id] = { before, after, delta: after - before, place: p.place };
  }
  return out;
}

/** "+16", "-8", "+0": a change as it is shown. */
export const signed = (delta: number) => `${delta < 0 ? '-' : '+'}${Math.abs(delta)}`;
