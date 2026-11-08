import type { GameResult } from '../contracts';
import { mayChat } from '../auth/policy';
import type { AccountStore } from '../auth/store';
import type { Cosmetics } from '../economy/catalog';
import type { EconomyService } from '../economy/service';
import type { Reward } from '../economy/rules';
import { METRICS, PERIODS, toStoredGame } from './results';
import type { Metric, Period, ResultsStore, UserStats } from './results';

export interface BoardRow {
  rank: number;
  userId: string;
  name: string;
  value: number;
  games: number;
  cosmetics?: Cosmetics;
}
export interface DailyBoardRow {
  rank: number;
  name: string;
  banked: number;
  longestWord: string;
  cosmetics?: Cosmetics;
}

export interface GameDataDeps {
  results: ResultsStore;
  accounts: AccountStore;
  economy: EconomyService;
  /** True for players under a chat ban; they are left off the leaderboards. */
  isBanned: (userId: string) => boolean;
  now: () => number;
  /** Told when a finished game paid a player, so their end screen can say so. */
  onAward?: (userId: string, reward: Reward & { balance: number }) => void;
  log?: (line: string) => void;
}

export const BOARD_SIZE = 50;
const OVERSAMPLE = 4; // hidden and banned players are removed after the query, so ask for more than is shown

/** Stores finished games, pays coins, and serves the leaderboards. The one place that decides whose results may be kept. */
export class GameDataService {
  constructor(private d: GameDataDeps) {}

  /** Results are stored only for players whose account may chat; others appear as anonymous rows. */
  async record(result: GameResult): Promise<void> {
    const allowed = new Set<string>();
    for (const p of result.players) {
      if (!p.userId) continue;
      const profile = await this.d.accounts.getProfile(p.userId);
      if (profile && profile.deletedAt === null && mayChat(profile.consentStatus)) allowed.add(p.userId);
    }
    const stored = toStoredGame(result, (id) => allowed.has(id));
    if (!(await this.d.results.saveGame(stored))) return; // already stored: never pay twice
    const awards = await this.d.economy.awardGame(stored);
    for (const [userId, reward] of awards) this.d.onAward?.(userId, reward);
    this.d.log?.(`[results] stored ${stored.mode} game, ${awards.size} player(s) paid`);
  }

  private async visible(userId: string) {
    const p = await this.d.accounts.getProfile(userId);
    return p && p.deletedAt === null && p.leaderboardVisible && !this.d.isBanned(userId) ? p : null;
  }

  async leaderboard(period: string, metric: string): Promise<{ period: Period; metric: Metric; rows: BoardRow[] } | null> {
    if (!PERIODS.includes(period as Period) || !METRICS.includes(metric as Metric)) return null;
    const raw = await this.d.results.leaderboard({ period: period as Period, metric: metric as Metric, now: this.d.now(), limit: BOARD_SIZE * OVERSAMPLE });
    const rows: BoardRow[] = [];
    for (const r of raw) {
      const p = await this.visible(r.userId);
      if (!p) continue;
      rows.push({ rank: rows.length + 1, userId: r.userId, name: p.nickname, value: r.value, games: r.games, cosmetics: await this.d.economy.cosmetics(r.userId) });
      if (rows.length === BOARD_SIZE) break;
    }
    return { period: period as Period, metric: metric as Metric, rows };
  }

  async dailyBoard(date: string): Promise<{ date: string; rows: DailyBoardRow[] }> {
    const raw = await this.d.results.dailyBoard(date, BOARD_SIZE * OVERSAMPLE);
    const rows: DailyBoardRow[] = [];
    for (const r of raw) {
      const p = r.userId ? await this.visible(r.userId) : null;
      if (!p) continue;
      rows.push({ rank: rows.length + 1, name: p.nickname, banked: r.banked, longestWord: r.longestWord, cosmetics: await this.d.economy.cosmetics(r.userId!) });
      if (rows.length === BOARD_SIZE) break;
    }
    return { date, rows };
  }

  async myStats(userId: string): Promise<UserStats> {
    return this.d.results.userStats(userId);
  }

  /** The Daily Table gate: one attempt per player per UTC day. */
  claimDaily(userId: string, date: string): Promise<boolean> {
    return this.d.results.claimDaily(userId, date, this.d.now());
  }

  /** Account deletion: the person's games stay (the other players played them) but lose the name; coins, items and friends go too. */
  async erase(userId: string): Promise<void> {
    await this.d.results.anonymizeUser(userId);
    await this.d.economy.erase(userId);
  }
}
