import { itemById } from '../../src/skin/shop/catalog';
import { buy, equip, freshWallet, grantStreakItems, mergeWallets, normalise, payGame } from '../../src/skin/shop/economy';
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
 */
export const IMPORT_COIN_CAP = 1000;
export const IMPORT_XP_CAP = 20_000;
const MAX_WORDS_PER_GAME = 200;
const WORD = /^[a-z]{1,30}$/;

export type Claim = { ok: true; wallet: Wallet; lines: Line[]; coins: number; xp: number; levelUp: { from: number; to: number; title?: string } | null; achievements: string[] }
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

export class BarnService {
  constructor(private store: BarnStore, private now: () => number = Date.now) {}

  async wallet(userId: string): Promise<{ wallet: Wallet; imported: boolean }> {
    const r = await this.store.get(userId);
    return { wallet: r.wallet ? normalise(r.wallet) : freshWallet(), imported: r.imported };
  }

  async claim(userId: string, gameId: string, reward: GameReward): Promise<Claim> {
    const at = this.now();
    return this.store.change(userId, (row) => {
      const p = payGame(normalise(row.wallet ?? freshWallet()), gameId, reward, utcDay(at));
      const out: Claim = { ok: true, wallet: p.wallet, lines: p.lines, coins: p.coins, xp: p.xp, levelUp: p.levelUp, achievements: p.achievements };
      return { row: p.lines.length ? { wallet: p.wallet, imported: row.imported } : null, out };
    }, at);
  }

  async buy(userId: string, itemId: string) {
    const at = this.now();
    return this.store.change(userId, (row) => {
      const r = buy(normalise(row.wallet ?? freshWallet()), itemId);
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

  /** Streak items for a Counting Sheep streak the browser reports (the dream is played in the browser). */
  async streak(userId: string, best: number): Promise<{ wallet: Wallet; granted: string[] }> {
    const at = this.now();
    const b = Math.max(0, Math.min(3660, Math.floor(best)));
    return this.store.change(userId, (row) => {
      const r = grantStreakItems(normalise(row.wallet ?? freshWallet()), b);
      return { row: r.granted.length ? { wallet: r.wallet, imported: row.imported } : null, out: r };
    }, at);
  }

  /**
   * Brings a browser's wallet into the account, once per account: the first device a player signs in on. Coins and XP
   * come in up to a cap (a browser's numbers can be edited), items, words and milestones come in whole; nothing is lowered.
   */
  async importLocal(userId: string, local: unknown): Promise<ImportResult> {
    const at = this.now();
    return this.store.change<ImportResult>(userId, (row) => {
      const server = normalise(row.wallet ?? freshWallet());
      if (row.imported) return { row: null, out: { wallet: server, imported: true, done: false } };
      const l = normalise(local);
      const capped: Wallet = { ...l, coins: Math.min(l.coins, IMPORT_COIN_CAP), xp: Math.min(l.xp, IMPORT_XP_CAP), paid: [], day: '', earnedToday: 0 };
      const merged = normalise({ ...mergeWallets(server, capped), coins: server.coins + capped.coins, xp: Math.max(server.xp, capped.xp), day: server.day, earnedToday: server.earnedToday, paid: server.paid });
      return { row: { wallet: merged, imported: true }, out: { wallet: merged, imported: true, done: true } };
    }, at);
  }

  async erase(userId: string) {
    await this.store.erase(userId);
  }
}
