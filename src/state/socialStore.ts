import { create } from 'zustand';
import { ApiError, api, useAuth } from '../auth/authStore';
import type { Cosmetics } from '../net/protocol';

export interface ShopItem {
  id: string;
  slot: 'color' | 'title' | 'badge' | 'theme';
  name: string;
  price: number;
  value: string;
  owned: boolean;
  equipped: boolean;
}
export interface BoardRow {
  rank: number;
  name: string;
  value: number;
  games: number;
  cosmetics?: Cosmetics;
}
export interface DailyRow {
  rank: number;
  name: string;
  banked: number;
  longestWord: string;
  cosmetics?: Cosmetics;
}
export interface Stats {
  gamesPlayed: number;
  wins: number;
  points: number;
  bestScore: number;
  longestWord: string;
  dailyPlayed: number;
}
export type Period = 'day' | 'week' | 'all';
export type Metric = 'wins' | 'points';

interface SocialState {
  balance: number | null;
  shop: ShopItem[] | null;
  board: { period: Period; metric: Metric; rows: BoardRow[] } | null;
  daily: { date: string; rows: DailyRow[] } | null;
  stats: Stats | null;
  error: string;
  notice: string;
  setBalance(n: number): void;
  clear(): void;
  refreshBalance(): Promise<void>;
  loadShop(): Promise<void>;
  buy(itemId: string): Promise<void>;
  equip(slot: string, itemId: string | null): Promise<void>;
  loadBoard(period: Period, metric: Metric): Promise<void>;
  loadDaily(): Promise<void>;
  loadStats(): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
}

/** Plain words for what the social, shop and board endpoints can answer. */
export function describeSocialError(code: string): string {
  switch (code) {
    case 'not_allowed': return 'Finish setting up your account first: give your country and age.';
    case 'insufficient': return 'Not enough coins yet. Play a few more games.';
    case 'owned': return 'You already have this.';
    case 'not_owned': return 'Buy it first.';
    case 'rate_limited': return 'Too many tries. Wait a moment.';
    case 'network': case 'no_server': return 'Cannot reach the game server.';
    default: return 'Something went wrong. Please try again.';
  }
}

export const useSocial = create<SocialState>((set, get) => {
  const token = () => useAuth.getState().session?.access_token ?? null;
  /** Runs a request; shows a plain-language error instead of throwing into the screen. */
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    set({ error: '' });
    try {
      return await fn();
    } catch (e) {
      set({ error: describeSocialError(e instanceof ApiError ? e.code : 'other') });
      return undefined;
    }
  }
  const get_ = <T,>(path: string) => api<T>('GET', path, token());
  const post = <T,>(path: string, body?: unknown) => api<T>('POST', path, token(), body ?? {});

  return {
    balance: null, shop: null, board: null, daily: null, stats: null, error: '', notice: '',
    setBalance: (balance) => set({ balance }),
    clear: () => set({ balance: null, shop: null, board: null, daily: null, stats: null, error: '', notice: '' }),

    async refreshBalance() {
      const r = await run(() => get_<{ balance: number }>('/api/wallet'));
      if (r) set({ balance: r.balance });
    },
    async loadShop() {
      const r = await run(() => get_<{ balance: number; items: ShopItem[] }>('/api/shop'));
      if (r) set({ shop: r.items, balance: r.balance });
    },
    async buy(itemId) {
      set({ notice: '' });
      const r = await run(() => post<{ balance: number }>('/api/shop/buy', { itemId }));
      if (r) {
        set({ balance: r.balance, notice: 'Bought. Put it on from the list.' });
        await get().loadShop();
      }
    },
    async equip(slot, itemId) {
      if (await run(() => post('/api/shop/equip', { slot, itemId }))) await get().loadShop();
    },
    async loadBoard(period, metric) {
      const r = await run(() => get_<{ period: Period; metric: Metric; rows: BoardRow[] }>(`/api/leaderboard/${period}?metric=${metric}`));
      if (r) set({ board: r });
    },
    async loadDaily() {
      const r = await run(() => get_<{ date: string; rows: DailyRow[] }>('/api/daily/today'));
      if (r) set({ daily: r });
    },
    async loadStats() {
      const r = await run(() => get_<Stats>('/api/me/stats'));
      if (r) set({ stats: r });
    },
    async setVisible(visible) {
      const r = await run(() => post<{ leaderboardVisible: boolean }>('/api/me/settings', { leaderboardVisible: visible }));
      if (r) {
        useAuth.setState((s) => (s.profile ? { profile: { ...s.profile, leaderboardVisible: r.leaderboardVisible } } : {}));
        set({ notice: r.leaderboardVisible ? 'You are on the leaderboards.' : 'You are hidden from the leaderboards.' });
      }
    },
  };
});
