import { create } from 'zustand';
import { createDictionary, dailySetup, rankPlayers, utcDateKey } from '../engine';
import type { Action, ActionResult, Difficulty, GameState } from '../engine';
import { getDaily, getStreak, markStarted, recordResult } from '../lib/daily';
import { checkNickname } from '../lib/nickname';
import { load, save } from '../lib/storage';
import { createLocalClient } from './gameClient';
import type { GameClient } from './gameClient';

export interface Settings {
  name: string;
  playerCount: number;
  difficulty: Difficulty;
}
export type Mode = 'quick' | 'daily';

interface Store {
  client: GameClient | null;
  dictStatus: 'loading' | 'ready' | 'error';
  game: GameState | null;
  mode: Mode;
  dailyDate: string | null;
  streak: number;
  settings: Settings;
  /** performance.now() of the latest frame. */
  now: number;
  muted: boolean;
  loadDictionary(): Promise<void>;
  setSettings(patch: Partial<Settings>): void;
  start(mode: Mode): boolean;
  rematch(): void;
  quit(): void;
  act(action: Action): ActionResult | null;
  frame(now: number): void;
  toggleMute(): void;
}

const SETTINGS_KEY = 'sap:settings';
const MUTE_KEY = 'sap:muted';

export const useStore = create<Store>((set, get) => ({
  client: null,
  dictStatus: 'loading',
  game: null,
  mode: 'quick',
  dailyDate: null,
  streak: 0,
  settings: load<Settings>(SETTINGS_KEY, { name: '', playerCount: 6, difficulty: 'medium' }),
  now: performance.now(),
  muted: load<boolean>(MUTE_KEY, false),

  async loadDictionary() {
    if (get().client) return;
    try {
      const res = await fetch('words.txt');
      if (!res.ok) throw new Error(String(res.status));
      const dict = createDictionary((await res.text()).split('\n'));
      set({ client: createLocalClient(dict), dictStatus: 'ready' });
    } catch {
      set({ dictStatus: 'error' });
    }
  },

  setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    save(SETTINGS_KEY, settings);
    set({ settings });
  },

  start(mode) {
    const { client, settings } = get();
    if (!client) return false;
    const nick = checkNickname(settings.name);
    if (!nick.ok) return false;
    const now = performance.now();
    let setup;
    let dailyDate: string | null = null;
    if (mode === 'daily') {
      dailyDate = utcDateKey(new Date());
      if (getDaily(dailyDate)) return false; // one attempt per day
      markStarted(dailyDate);
      setup = dailySetup(new Date(), nick.name, now);
    } else {
      setup = {
        seed: `quick:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: settings.playerCount, difficulty: settings.difficulty,
      };
    }
    set({ game: client.create(setup), mode, dailyDate, now, streak: 0 });
    return true;
  },

  rematch() {
    if (get().mode === 'quick') get().start('quick');
  },

  quit() {
    set({ game: null });
  },

  act(action) {
    const { client, game } = get();
    if (!client || !game) return null;
    const now = performance.now();
    const result = client.act(game, action, now);
    set({ game: result.state, now });
    return result;
  },

  frame(now) {
    const { client, game, mode, dailyDate } = get();
    if (!client || !game) return;
    const next = client.tick(game, now);
    if (next === game) {
      set({ now });
      return;
    }
    set({ game: next, now });
    if (next.phase === 'gameOver' && game.phase !== 'gameOver' && mode === 'daily' && dailyDate) {
      const ranked = rankPlayers(next.players);
      const me = next.players[0];
      const streak = recordResult({
        date: dailyDate, status: 'done',
        rank: ranked.findIndex((p) => p.id === 0) + 1,
        players: next.players.length, banked: me.banked, steals: me.steals,
        longest: me.longestWord.length,
      });
      set({ streak });
    }
  },

  toggleMute() {
    const muted = !get().muted;
    save(MUTE_KEY, muted);
    set({ muted });
  },
}));

export { getDaily, getStreak };
