import { create } from 'zustand';
import { createDictionary, dailySetup, rankPlayers, suggestWords, utcDateKey } from '../engine';
import { DEFAULT_SETTINGS } from '../engine';
import type { Action, ActionResult, Dictionary, Difficulty, GameSettings, GameState } from '../engine';
import { getDaily, getStreak, markStarted, recordResult } from '../lib/daily';
import { checkNickname } from '../lib/nickname';
import { load, save } from '../lib/storage';
import { isTourDone, setTourDone } from '../lib/tips';
import { bridge } from './bridge';
import { createLocalClient } from './gameClient';
import type { GameClient } from './gameClient';

export interface Settings {
  name: string;
  playerCount: number;
  difficulty: Difficulty;
  /** Game length rules for Quick Games (plan V3.3 Part 2); the last choice is remembered. */
  game: GameSettings;
}
export type Mode = 'quick' | 'daily' | 'practice' | 'tour' | 'room';

interface Store {
  client: GameClient | null;
  dict: Dictionary | null;
  dictStatus: 'loading' | 'ready' | 'error';
  game: GameState | null;
  mode: Mode;
  /** Which seat is the local player's. Always 0 in solo games; set by the server in rooms. */
  mySeat: number;
  dailyDate: string | null;
  streak: number;
  settings: Settings;
  /** performance.now() of the latest frame. */
  now: number;
  muted: boolean;
  /** Master volume, 0 to 1. */
  volume: number;
  /** Overrides the OS reduced-motion setting when on. */
  reduceMotion: boolean;
  largeText: boolean;
  /** Tutorial pause: the game clock stops; `now` stays at the moment of the pause. */
  paused: boolean;
  pausedRaw: number;
  /** Total time spent paused. Engine time is performance.now() minus this. */
  timeOffset: number;
  tourDone: boolean;
  afterTour: 'menu' | 'quick';
  loadDictionary(): Promise<void>;
  setSettings(patch: Partial<Settings>): void;
  start(mode: Mode): boolean;
  rematch(): void;
  quit(): void;
  /** Solo games answer at once; room games answer after the server replies. */
  act(action: Action): ActionResult | null | Promise<ActionResult | null>;
  frame(now: number): void;
  toggleMute(): void;
  setVolume(v: number): void;
  setReduceMotion(on: boolean): void;
  setLargeText(on: boolean): void;
  retryDictionary(): Promise<void>;
  pause(): void;
  resume(): void;
  startTour(after: 'menu' | 'quick'): boolean;
  endTour(next: 'menu' | 'quick'): void;
  /** Valid words for the current chain letter (practice hints). */
  suggest(count: number): string[];
}

const SETTINGS_KEY = 'sap:settings';

/** Saved settings, with the game rules filled in over the defaults (saves from before v3.3 have none). */
function loadSettings(): Settings {
  const saved = load<Partial<Settings>>(SETTINGS_KEY, {});
  return { name: '', playerCount: 6, difficulty: 'medium', ...saved, game: { ...DEFAULT_SETTINGS, ...(saved.game ?? {}) } };
}
const MUTE_KEY = 'sap:muted';
const VOLUME_KEY = 'sap:volume';
const REDUCE_KEY = 'sap:reduceMotion';
const LARGE_KEY = 'sap:largeText';

export const useStore = create<Store>((set, get) => ({
  client: null,
  dict: null,
  dictStatus: 'loading',
  game: null,
  mode: 'quick',
  mySeat: 0,
  dailyDate: null,
  streak: 0,
  settings: loadSettings(),
  now: performance.now(),
  muted: load<boolean>(MUTE_KEY, false),
  volume: Math.min(1, Math.max(0, load<number>(VOLUME_KEY, 0.8))),
  reduceMotion: load<boolean>(REDUCE_KEY, false),
  largeText: load<boolean>(LARGE_KEY, false),
  paused: false,
  pausedRaw: 0,
  timeOffset: 0,
  tourDone: isTourDone(),
  afterTour: 'menu',

  async loadDictionary() {
    if (get().client) return;
    try {
      const res = await fetch('words.txt');
      if (!res.ok) throw new Error(String(res.status));
      const dict = createDictionary((await res.text()).split('\n'));
      set({ client: createLocalClient(dict), dict, dictStatus: 'ready' });
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
    } else if (mode === 'practice' || mode === 'tour') {
      setup = {
        seed: `${mode}:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: 4, difficulty: 'easy' as Difficulty, mode,
      };
    } else {
      setup = {
        seed: `quick:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: settings.playerCount, difficulty: settings.difficulty,
        settings: { ...settings.game, botCount: settings.playerCount - 1, botDifficulty: settings.difficulty },
      };
    }
    set({ game: client.create(setup), mode, mySeat: 0, dailyDate, now, streak: 0, paused: false, timeOffset: 0 });
    return true;
  },

  rematch() {
    const { mode } = get();
    if (mode === 'quick' || mode === 'practice') get().start(mode);
  },

  quit() {
    if (get().mode === 'room') bridge.leaveRoom?.();
    set({ game: null, paused: false, timeOffset: 0 });
  },

  act(action) {
    const { client, game, paused, mode, timeOffset } = get();
    if (mode === 'room') return bridge.act ? bridge.act(action) : null;
    if (!client || !game) return null;
    if (paused && mode !== 'tour') return null;
    // While the tour pauses the clock, actions land at the frozen moment.
    const now = paused ? get().now : performance.now() - timeOffset;
    const result = client.act(game, action, now);
    set({ game: result.state, now });
    return result;
  },

  frame(raw) {
    const { client, game, mode, dailyDate, paused, timeOffset } = get();
    if (mode === 'room') {
      // The server runs the game. This browser only keeps a clock in the server's time.
      if (game) set({ now: Date.now() + bridge.skew() });
      return;
    }
    if (!client || !game || paused) return;
    const now = raw - timeOffset;
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

  pause() {
    if (get().paused) return;
    set({ paused: true, pausedRaw: performance.now() });
  },

  resume() {
    const { paused, pausedRaw, timeOffset } = get();
    if (!paused) return;
    set({ paused: false, timeOffset: timeOffset + (performance.now() - pausedRaw) });
  },

  startTour(after) {
    set({ afterTour: after });
    return get().start('tour');
  },

  endTour(next) {
    setTourDone(true);
    set({ tourDone: true });
    get().quit();
    if (next === 'quick') get().start('quick');
  },

  suggest(count) {
    const { dict, game } = get();
    if (!dict || !game) return [];
    return suggestWords({
      dict, chainLetter: game.chainLetter, used: game.used, modifier: game.modifier, count, random: Math.random,
    });
  },

  setVolume(v) {
    const volume = Math.min(1, Math.max(0, v));
    save(VOLUME_KEY, volume);
    set({ volume });
  },

  setReduceMotion(on) {
    save(REDUCE_KEY, on);
    set({ reduceMotion: on });
  },

  setLargeText(on) {
    save(LARGE_KEY, on);
    set({ largeText: on });
  },

  async retryDictionary() {
    if (get().client) return;
    set({ dictStatus: 'loading' });
    await get().loadDictionary();
  },

  toggleMute() {
    const muted = !get().muted;
    save(MUTE_KEY, muted);
    set({ muted });
  },
}));

export { getDaily, getStreak };
