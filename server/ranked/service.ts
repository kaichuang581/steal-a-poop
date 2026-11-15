import { RANKED_START, ratingChanges } from '../../src/lib/ranked';
import type { RatingChange } from '../../src/lib/ranked';
import type { RankedRow, RankedStore } from './store';

export const BOARD_SIZE = 100;
const BOARD_TTL_MS = 60_000;

export interface RankedMe { rating: number; games: number; wins: number; peak: number }
export interface RankedBoard {
  /** The highest-rated players, best first. Names only: no account ids leave the server. */
  top: { place: number; name: string; rating: number; games: number; wins: number; you: boolean }[];
  /** The asker's own place among everyone who has finished a ranked game, or null before their first. */
  you: { place: number; of: number } | null;
}

/**
 * Ranked ratings: reads them, changes them when a ranked game ends, and lists the best. The maths is src/lib/ranked.ts;
 * this only keeps the numbers. A player with no row yet is a newcomer at RANKED_START.
 */
export class RankedService {
  /** Ratings of players seen lately, so a room can show them without a database read for every broadcast. */
  private cache = new Map<string, number>();
  private board: { at: number; rows: { userId: string; name: string; rating: number; games: number; wins: number }[] } | null = null;

  constructor(
    private store: RankedStore,
    private now: () => number = Date.now,
    /** A player's public name, or null when they are not to be listed (hidden, deleted or banned), as on the other boards. */
    private nameOf: (userId: string) => Promise<string | null> = async () => null,
  ) {}

  private fresh = (): RankedRow => ({ rating: RANKED_START, games: 0, wins: 0, peak: RANKED_START, updatedAt: 0 });

  /** A player's rating, read and remembered. */
  async load(userId: string): Promise<number> {
    const row = (await this.store.get(userId)) ?? this.fresh();
    this.cache.set(userId, row.rating);
    return row.rating;
  }

  /** The rating last seen for a player, if any: for showing beside a name, never for the maths. */
  cached(userId: string): number | undefined {
    return this.cache.get(userId);
  }

  async me(userId: string): Promise<RankedMe> {
    const row = (await this.store.get(userId)) ?? this.fresh();
    this.cache.set(userId, row.rating);
    return { rating: row.rating, games: row.games, wins: row.wins, peak: row.peak };
  }

  /**
   * A ranked game is over: everyone who sat down is rated against everyone else by where they finished, and the new
   * ratings are stored. Ratings are read here, not taken from the room, so a change is always made to the stored number.
   */
  async finish(places: readonly { userId: string; place: number }[]): Promise<Record<string, RatingChange>> {
    if (places.length === 0) return {};
    const rows = await this.store.getMany(places.map((p) => p.userId));
    const row = (id: string) => rows.get(id) ?? this.fresh();
    const changes = ratingChanges(places.map((p) => ({ id: p.userId, rating: row(p.userId).rating, place: p.place })));
    const at = this.now();
    const winners = places.filter((p) => p.place === 1);
    await Promise.all(places.map((p) => {
      const was = row(p.userId), c = changes[p.userId];
      this.cache.set(p.userId, c.after);
      return this.store.put(p.userId, {
        rating: c.after, games: was.games + 1, wins: was.wins + (p.place === 1 && winners.length === 1 ? 1 : 0), peak: Math.max(was.peak, c.after), updatedAt: at,
      });
    }));
    this.board = null;
    return changes;
  }

  /** The top of the ladder and where the asker stands. The list is read at most once a minute. */
  async boardFor(userId: string): Promise<RankedBoard> {
    const at = this.now();
    if (!this.board || at - this.board.at > BOARD_TTL_MS) {
      // A few spare rows, so players who may not be named do not leave the board short.
      const raw = await this.store.top(BOARD_SIZE + 20);
      const named = await Promise.all(raw.map(async (r) => ({ ...r, name: await this.nameOf(r.userId) })));
      this.board = { at, rows: named.filter((r): r is typeof r & { name: string } => r.name !== null).slice(0, BOARD_SIZE) };
    }
    const mine = await this.store.get(userId);
    const you = mine && mine.games > 0 ? await this.store.standing(mine.rating).then((s) => ({ place: s.above + 1, of: s.total })) : null;
    return {
      top: this.board.rows.map((r, i) => ({ place: i + 1, name: r.name, rating: r.rating, games: r.games, wins: r.wins, you: r.userId === userId })),
      you,
    };
  }

  async erase(userId: string): Promise<void> {
    this.cache.delete(userId);
    this.board = null;
    await this.store.erase(userId);
  }
}
