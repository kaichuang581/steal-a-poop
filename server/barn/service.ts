import { itemById } from '../../src/skin/shop/catalog';
import { buy, equip, freshPities, freshWallet, grantStreakItems, levelOf, mergeWallets, MISSIONS, normalise, openSack, payGame } from '../../src/skin/shop/economy';
import type { SackResult } from '../../src/skin/shop/economy';
import { cryptoRand } from '../../src/skin/shop/roll';
import type { SackId } from '../../src/skin/shop/sacks';
import type { GameReward, Line, Wallet } from '../../src/skin/shop/economy';
import type { BarnStore } from './store';

/**
 * The Barn Bazaar for signed-in players: the same rules as the browser's wallet (src/skin/shop/economy.ts), kept on
 * the server so coins and cosmetics follow the player to any device.
 *
 * What the server can and cannot check: solo games (Quick Games, practice, Counting Sheep) are played in the browser,
 * so the server cannot see them. It takes the browser's report of a finished game, checks its shape and limits, pays
 * it at most once (by game id), and holds the daily cap itself. So the most anyone can take by faking reports is the
 * daily cap of cosmetic-only coins. Prices always come from the catalogue here, never from the request.
 *
 * The same goes for the two other things a browser can only tell the server: its Counting Sheep streak, which the
 * server lets rise one night for each day gone by, whatever number is sent; and the wallet a browser brings to a new
 * account, which comes in under the IMPORT caps below, with no rarer items than a little play could have found and
 * fresh pity counters. Before, one request claiming a ten-year streak was paid thousands of Golden Bells.
 */
export const IMPORT_COIN_CAP = 1000;
export const IMPORT_XP_CAP = 20_000;
/** Golden Bells a browser may bring, counting the price of any Bell Shelf items it says it bought. */
export const IMPORT_BELL_CAP = 100;
/** The longest Counting Sheep streak a browser may bring: a week. The rest is earned a night at a time on the account. */
export const IMPORT_STREAK_CAP = 7;
/** How many rare and legendary Feed Sack items a browser may bring; the server rolls every sack after that. */
export const IMPORT_RARE_CAP = 2;
export const IMPORT_LEGENDARY_CAP = 1;
/** The profile's board: how many players it lists, and how long one reading of it is served for. */
export const BOARD_TOP = 100;
const BOARD_TTL_MS = 60_000;
const MAX_WORDS_PER_GAME = 200;
const WORD = /^[a-z]{1,30}$/;

export type Claim = { ok: true; wallet: Wallet; lines: Line[]; coins: number; xp: number; levelUp: { from: number; to: number; title?: string } | null; achievements: string[]; items: string[]; bells: number }
  | { ok: false; reason: 'bad_request' };

/** A finished game's report, checked: the right mode, sensible numbers, real-looking words. Null if it is not. */
export function readReward(raw: unknown): GameReward | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const words = (v: unknown) => (Array.isArray(v) && v.length <= MAX_WORDS_PER_GAME && v.every((w) => typeof w === 'string' && WORD.test(w.toLowerCase())) ? (v as string[]).map((w) => w.toLowerCase()) : null);
  const count = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
  if (r.mode === 'quick') {
    const w = words(r.words);
    return typeof r.won === 'boolean' && w ? { mode: 'quick', won: r.won, words: w } : null;
  }
  if (r.mode === 'practice') {
    const w = words(r.words), score = count(r.score, 500);
    return w && score !== null ? { mode: 'practice', score, words: w } : null;
  }
  if (r.mode === 'dream') {
    const sheep = count(r.sheep, 1000);
    return sheep !== null && typeof r.slept === 'boolean' ? { mode: 'dream', sheep, slept: r.slept } : null;
  }
  return null;
}

/** A game id from the browser: `quick:`, `practice:` or `dream:` and a seed. Never the admin's previews. */
export const readGameId = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= 120 && /^(quick|practice|dream):[\w:.-]+$/.test(v) && !v.includes('preview:') ? v : null;

export type EquipResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'not_owned' };
export type ImportResult = { wallet: Wallet; imported: boolean; done: boolean };

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

export interface BoardRow { place: number; name: string; xp: number; level: number; you: boolean }
export interface Board {
  /** The BOARD_TOP players with the most XP, most first. No account ids: a name, a level, an XP count. */
  top: BoardRow[];
  /** How many players have any XP at all. */
  players: number;
  /** Where the asker stands among them (1 is the most XP); null until they have any XP. */
  you: { place: number; xp: number } | null;
}

/**
 * What a browser's wallet may bring into a new account (see the caps above). Items: everything free, common and
 * uncommon; rare and legendary Feed Sack items up to their caps (the ones being worn first); Bell Shelf items while
 * their prices fit under the Bell cap; mission items only if the capped streak has earned them.
 */
export function importable(local: Wallet, today: string): Wallet {
  const streak = Math.min(local.bestStreak, IMPORT_STREAK_CAP);
  const worn = new Set(Object.values(local.equipped));
  const order = [...local.owned].sort((a, b) => Number(worn.has(b)) - Number(worn.has(a)));
  let rare = 0, legendary = 0, bellRoom = IMPORT_BELL_CAP;
  const owned = order.filter((id) => {
    const item = itemById(id);
    if (!item) return false;
    if (item.source === 'free') return true;
    if (item.source === 'mission') return MISSIONS.some((m) => m.itemId === id && streak >= m.need);
    if (item.source === 'bells') { const price = item.price ?? 0; if (price > bellRoom) return false; bellRoom -= price; return true; }
    if (item.rarity === 'rare') return rare++ < IMPORT_RARE_CAP;
    if (item.rarity === 'legendary') return legendary++ < IMPORT_LEGENDARY_CAP;
    return true;
  });
  return normalise({
    ...local, owned, coins: Math.min(local.coins, IMPORT_COIN_CAP), xp: Math.min(local.xp, IMPORT_XP_CAP), bells: Math.min(local.bells, bellRoom),
    bestStreak: streak, streakDay: streak > 0 ? today : '', bellStreak: Math.max(local.bellStreak, Math.floor(streak / 7) * 7),
    pity: freshPities(), paid: [], day: '', earnedToday: 0,
  });
}

export class BarnService {
  private board_: { at: number; rows: { userId: string; name: string; xp: number }[]; players: number } | null = null;
  /**
   * `nameOf` gives the name a player is shown under on a public board, or null for one who must not be listed (a
   * deleted or hidden account, a banned player). Without it nobody is listed.
   */
  constructor(private store: BarnStore, private now: () => number = Date.now, private nameOf: (userId: string) => Promise<string | null> = async () => null) {}

  async wallet(userId: string): Promise<{ wallet: Wallet; imported: boolean }> {
    const r = await this.store.get(userId);
    return { wallet: r.wallet ? normalise(r.wallet) : freshWallet(), imported: r.imported };
  }

  async claim(userId: string, gameId: string, reward: GameReward): Promise<Claim> {
    const at = this.now();
    return this.store.change(userId, (row) => {
      const p = payGame(normalise(row.wallet ?? freshWallet()), gameId, reward, utcDay(at));
      const out: Claim = { ok: true, wallet: p.wallet, lines: p.lines, coins: p.coins, xp: p.xp, levelUp: p.levelUp, achievements: p.achievements, items: p.items, bells: p.bells };
      return { row: p.lines.length ? { wallet: p.wallet, imported: row.imported } : null, out };
    }, at);
  }

  /** Buys a Bell Shelf item for Golden Bells; the price comes from the catalogue here, never from the request. */
  async buy(userId: string, itemId: string) {
    const at = this.now();
    return this.store.change(userId, (row) => {
      const r = buy(normalise(row.wallet ?? freshWallet()), itemId);
      return { row: r.ok ? { wallet: r.wallet, imported: row.imported } : null, out: r };
    }, at);
  }

  /** Opens one sack of the kind asked for. The server rolls (crypto), so a browser can't choose its result. */
  async openSack(userId: string, sack: SackId, rand: () => number = cryptoRand): Promise<SackResult> {
    const at = this.now();
    return this.store.change<SackResult>(userId, (row) => {
      const r = openSack(normalise(row.wallet ?? freshWallet()), sack, rand, at);
      return { row: r.ok ? { wallet: r.wallet, imported: row.imported } : null, out: r };
    }, at);
  }

  async equip(userId: string, itemId: string): Promise<EquipResult> {
    const at = this.now();
    return this.store.change<EquipResult>(userId, (row) => {
      const before = normalise(row.wallet ?? freshWallet());
      const item = itemById(itemId);
      if (!item || !before.owned.includes(itemId)) return { row: null, out: { ok: false as const, reason: 'not_owned' as const } };
      const w = equip(before, itemId);
      return { row: { wallet: w, imported: row.imported }, out: { ok: true as const, wallet: w } };
    }, at);
  }

  /**
   * Streak items and Bells for a Counting Sheep streak the browser reports. The dream is played in the browser, so
   * the number is only the browser's word: whatever it says, the account's streak rises by at most one night for each
   * day gone by since it last rose (one, the first time). A real streak grows exactly that fast, so an honest player
   * never notices; a made-up one earns nothing a month of nights would not.
   */
  async streak(userId: string, best: number): Promise<{ wallet: Wallet; granted: string[]; bells: number; changed: boolean }> {
    const at = this.now(), today = utcDay(at);
    const said = Math.max(0, Math.min(3660, Math.floor(best)));
    return this.store.change(userId, (row) => {
      const before = normalise(row.wallet ?? freshWallet());
      const since = before.streakDay ? Math.max(0, Math.round((Date.parse(today) - Date.parse(before.streakDay)) / DAY_MS)) : 1;
      const r = grantStreakItems(before, Math.min(said, before.bestStreak + since));
      if (r.wallet.bestStreak > before.bestStreak) r.wallet.streakDay = today;
      return { row: r.changed ? { wallet: r.wallet, imported: row.imported } : null, out: r };
    }, at);
  }

  /**
   * Brings a browser's wallet into the account, once per account: the first device a player signs in on. A browser's
   * numbers can be edited, so everything that is worth something comes in under a cap (`importable`); words and
   * milestones come in whole; nothing the account already has is lowered.
   */
  async importLocal(userId: string, local: unknown): Promise<ImportResult> {
    const at = this.now();
    return this.store.change<ImportResult>(userId, (row) => {
      const server = normalise(row.wallet ?? freshWallet());
      if (row.imported) return { row: null, out: { wallet: server, imported: true, done: false } };
      const capped = importable(normalise(local), utcDay(at));
      const merged = normalise({
        ...mergeWallets(server, capped), coins: server.coins + capped.coins, xp: Math.max(server.xp, capped.xp), bells: server.bells + capped.bells,
        day: server.day, earnedToday: server.earnedToday, paid: server.paid, pity: server.pity,
      });
      return { row: { wallet: merged, imported: true }, out: { wallet: merged, imported: true, done: true } };
    }, at);
  }

  /**
   * Where the player stands by XP among signed-in players who have played: their place (1 is the most XP) and the
   * count. Null until they have any XP. `top` is the share of players at or above them, in whole percent, at least 1.
   */
  async rank(userId: string): Promise<{ xp: number; place: number; players: number; top: number } | null> {
    const { wallet } = await this.store.get(userId);
    const xp = normalise(wallet ?? freshWallet()).xp;
    if (xp <= 0) return null;
    const { above, total } = await this.store.rank(xp);
    const players = Math.max(total, above + 1);
    const place = above + 1;
    return { xp, place, players, top: Math.max(1, Math.ceil((100 * place) / players)) };
  }

  /**
   * The profile's board (Brian, 2026-11-13: "something that shows the top 100 players, and then anything below the top
   * 100, people should see on their screen, 'you are in the top 0.0005%'"): the BOARD_TOP players by XP, how many
   * players there are, and where the asker stands. The list is read once a minute at most, for everyone; the asker's
   * own place comes from it if they are on it, and from one count otherwise.
   */
  async board(userId: string): Promise<Board> {
    const at = this.now();
    if (!this.board_ || at - this.board_.at > BOARD_TTL_MS) {
      const rows: { userId: string; name: string; xp: number }[] = [];
      // Hidden and banned players are left out after the query, so more are asked for than are shown.
      for (const r of await this.store.top(BOARD_TOP * 2)) {
        const name = await this.nameOf(r.userId);
        if (name) rows.push({ ...r, name });
        if (rows.length === BOARD_TOP) break;
      }
      this.board_ = { at, rows, players: (await this.store.rank(0)).total };
    }
    const { rows, players } = this.board_;
    const top = rows.map((r, i) => ({ place: i + 1, name: r.name, xp: r.xp, level: levelOf(r.xp).level, you: r.userId === userId }));
    const mine = top.find((r) => r.you);
    if (mine) return { top, players: Math.max(players, top.length), you: { place: mine.place, xp: mine.xp } };
    const r = await this.rank(userId);
    return { top, players: Math.max(players, r?.players ?? 0, top.length), you: r ? { place: Math.max(r.place, top.length === BOARD_TOP ? BOARD_TOP + 1 : r.place), xp: r.xp } : null };
  }

  async erase(userId: string) {
    this.board_ = null;
    await this.store.erase(userId);
  }
}
