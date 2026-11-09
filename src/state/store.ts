import { create } from 'zustand';
import { createDictionary, dailySetup, rankPlayers, suggestWords, utcDateKey } from '../engine';
import { DEFAULT_SETTINGS, PRESETS } from '../engine';
import type { Action, ActionResult, Dictionary, Difficulty, GameSettings, GameState } from '../engine';
import { getDaily, getStreak, markStarted, recordResult } from '../lib/daily';
import { checkNickname } from '../lib/nickname';
import { recordPracticeRun } from '../lib/practice';
import { isFirstGames, needsSoftGame, recordBests, recordQuickResult } from '../lib/record';
import type { GameResult } from '../lib/record';
import type { PracticeRun } from '../lib/practice';
import { clearSoloGame, loadSoloGame, saveSoloGame, type SavedSoloGame } from '../lib/soloSave';
import { loadStats, recordGame, resetStats as resetStoredStats, type StatsData } from '../lib/stats';
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
  /** The practice run's difficulty: the starting clock and the bot. The last choice is remembered. */
  practice: { clock: NonNullable<GameSettings['practiceClock']>; difficulty: Difficulty };
  /** The player has set a table of their own, so the easy first games no longer apply. */
  tableChosen?: boolean;
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
  /** The practice run that just ended, measured against its best. */
  practiceResult: PracticeRun | null;
  /** The Quick Game or Daily Table that just ended, measured against the player's bests. */
  gameResult: GameResult | null;
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
  /** The loading screen's hold: the clock stays stopped while the barn doors are shut over a new game, so its intro and
   *  first turn start when the player can see them. Separate from `paused`, which the tutorial owns. */
  held: boolean;
  /** When the clock last stopped, for `paused` or `held`, whichever came first. */
  pausedRaw: number;
  /** Total time spent paused. Engine time is performance.now() minus this. */
  timeOffset: number;
  tourDone: boolean;
  afterTour: 'menu' | 'quick';
  /** A Quick or Practice game left behind by an earlier visit, if it is still fresh. */
  resumable: SavedSoloGame | null;
  /** Local-only stats for finished Quick and Practice games. */
  stats: StatsData;
  loadDictionary(): Promise<void>;
  setSettings(patch: Partial<Settings>): void;
  /**
   * Starts a solo game. `rules` (game length settings) only applies to Quick Games and is passed by the painted home
   * screen, which is the only place they can be chosen; without it a game uses today's rules, so the classic look is unchanged.
   */
  start(mode: Mode, rules?: GameSettings, difficulty?: Difficulty): boolean;
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
  /** Stops a solo game's clock while the loading screen covers it (no effect in rooms, where the server keeps time). */
  holdClock(): void;
  releaseClock(): void;
  /** Re-reads the saved game. The start screen calls this when it appears. */
  refreshResume(): void;
  /** Restores a saved game and continues its clock from where it stopped. */
  resumeSaved(): boolean;
  /** Wipes local stats. Callers ask the player to confirm first. */
  resetStats(): void;
  startTour(after: 'menu' | 'quick'): boolean;
  endTour(next: 'menu' | 'quick'): void;
  /** Valid words for the current chain letter (tutorial hints). */
  suggest(count: number): string[];
}

const SETTINGS_KEY = 'sap:settings';

/**
 * A gap between frames longer than this (ms) is time the player could not see or act in: the tab was hidden, the window
 * was covered (Chrome stops drawing it), or the page froze while it built something. A solo game's clock does not run
 * through it (found by Brian, 2026-11-09: "sometimes it skips my turn": the turn ran out unseen and the game caught up
 * all at once on the next frame). Rooms keep the server's time.
 */
export const STALL_MS = 400;
/** performance.now() of the last frame of this solo game, or null before its first. */
let lastRaw: number | null = null;
/** The clock offset with any stall since the last frame taken out of the game's time. */
function absorbStall(raw: number, timeOffset: number): number {
  const gap = lastRaw === null ? 0 : raw - lastRaw;
  lastRaw = raw;
  return gap > STALL_MS ? timeOffset + gap - 17 : timeOffset;
}

/** Saved settings, with the game rules filled in over the defaults (saves from before v3.3 have none). */
function loadSettings(): Settings {
  const saved = load<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    name: '', playerCount: 6, difficulty: 'medium', ...saved,
    game: { ...DEFAULT_SETTINGS, ...(saved.game ?? {}) },
    practice: { clock: 15, difficulty: 'easy', ...(saved.practice ?? {}) },
  };
}

/** The table a Quick Game sits down to: easy and short for the first games, unless the player has set their own. */
export function tableFor(s: Settings): { first: boolean; difficulty: Difficulty; game: GameSettings } {
  const first = !s.tableChosen && isFirstGames();
  return first ? { first, difficulty: 'easy', game: { ...s.game, ...PRESETS.quick } } : { first, difficulty: s.difficulty, game: s.game };
}

/** What to keep if this step of a solo game ended it: the player's results and bests, or a practice score. */
function finished(mode: Mode, before: GameState, after: GameState): Partial<Store> | null {
  if (before.phase === 'gameOver' || after.phase !== 'gameOver') return null;
  if (mode === 'practice') return { practiceResult: recordPracticeRun(after.settings.practiceClock ?? 15, after.settings.botDifficulty, after.players[0].wordsPlayed) };
  if (mode !== 'quick' && mode !== 'daily') return null;
  if (mode === 'quick') recordQuickResult(after.winners?.includes(0) ?? false, !!after.settings.softGame);
  const me = after.players[0];
  return { gameResult: recordBests({ wool: me.lives, longest: me.longestWord }) };
}
const MUTE_KEY = 'sap:muted';
const VOLUME_KEY = 'sap:volume';
const REDUCE_KEY = 'sap:reduceMotion';
const LARGE_KEY = 'sap:largeText';

/** Quick and Practice games run in this browser: they can be resumed, and only their results count towards local stats. */
function isSolo(mode: Mode): mode is 'quick' | 'practice' {
  return mode === 'quick' || mode === 'practice';
}

/** Mirrors the live game into localStorage. A finished game is not worth resuming, so it is cleared. */
function persist(mode: Mode, game: GameState | null, engineNow: number): void {
  if (!isSolo(mode)) return;
  if (!game || game.phase === 'gameOver') clearSoloGame();
  else saveSoloGame(mode, game, engineNow);
}

/** True on the update that finishes the game, so a result is recorded exactly once. */
function justFinished(prev: GameState, next: GameState): boolean {
  return next.phase === 'gameOver' && prev.phase !== 'gameOver';
}

export const useStore = create<Store>((set, get) => ({
  client: null,
  dict: null,
  dictStatus: 'loading',
  game: null,
  mode: 'quick',
  mySeat: 0,
  dailyDate: null,
  practiceResult: null,
  gameResult: null,
  streak: 0,
  settings: loadSettings(),
  now: performance.now(),
  muted: load<boolean>(MUTE_KEY, false),
  volume: Math.min(1, Math.max(0, load<number>(VOLUME_KEY, 0.8))),
  reduceMotion: load<boolean>(REDUCE_KEY, false),
  largeText: load<boolean>(LARGE_KEY, false),
  paused: false,
  held: false,
  pausedRaw: 0,
  timeOffset: 0,
  tourDone: isTourDone(),
  afterTour: 'menu',
  resumable: loadSoloGame(),
  stats: loadStats(),

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

  start(mode, chosen, level) {
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
    } else if (mode === 'practice') {
      setup = {
        seed: `practice:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: 2, difficulty: settings.practice.difficulty, mode,
        settings: { practiceClock: settings.practice.clock },
      };
    } else if (mode === 'tour') {
      setup = {
        seed: `tour:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: 4, difficulty: 'easy' as Difficulty, mode,
      };
    } else {
      const table = tableFor(settings);
      const difficulty = level ?? table.difficulty;
      const rules = chosen ?? (table.first ? table.game : undefined);
      setup = {
        seed: `quick:${Date.now()}:${Math.random()}`,
        now, humanName: nick.name, playerCount: settings.playerCount, difficulty,
        settings: {
          timeCarry: 'more' as const, ...(rules ?? {}), ...(rules ? { botCount: settings.playerCount - 1, botDifficulty: difficulty } : {}),
          softGame: needsSoftGame(),
        },
      };
    }
    const game = client.create(setup);
    persist(mode, game, now);
    lastRaw = null;
    set({ game, mode, mySeat: 0, dailyDate, now, streak: 0, paused: false, held: false, timeOffset: 0, practiceResult: null, gameResult: null, resumable: null });
    return true;
  },

  rematch() {
    const { mode, game } = get();
    // A Quick Game rematch is the same table: the rules and the bots the last game was played with.
    if (mode === 'quick') get().start(mode, game?.settings, game?.settings.botDifficulty);
    else if (mode === 'practice') get().start(mode);
  },

  quit() {
    const { mode } = get();
    if (mode === 'room') bridge.leaveRoom?.();
    // Leaving on purpose throws the game away, so a solo game cannot be resumed afterwards. Quitting
    // a Daily or tutorial game leaves an unrelated saved solo game alone.
    if (isSolo(mode)) clearSoloGame();
    lastRaw = null;
    set({ game: null, paused: false, held: false, timeOffset: 0, resumable: loadSoloGame() });
  },

  act(action) {
    const { client, game, paused, held, mode, timeOffset } = get();
    if (mode === 'room') return bridge.act ? bridge.act(action) : null;
    if (!client || !game || held) return null;
    if (paused && mode !== 'tour') return null;
    // A key pressed straight after a stall (back on the tab) lands after it, not at the end of it.
    const raw = performance.now();
    const offset = paused ? timeOffset : absorbStall(raw, timeOffset);
    if (offset !== timeOffset) set({ timeOffset: offset });
    // While the tour pauses the clock, actions land at the frozen moment.
    const now = paused ? get().now : raw - offset;
    const result = client.act(game, action, now);
    set({ game: result.state, now });
    persist(mode, result.state, now);
    const done = finished(mode, game, result.state);
    if (done) set(done);
    if (justFinished(game, result.state) && isSolo(mode)) {
      set({ stats: recordGame(result.state, mode) });
    }
    return result;
  },

  frame(raw) {
    const { client, game, mode, dailyDate, paused, held, timeOffset } = get();
    if (mode === 'room') {
      // The server runs the game. This browser only keeps a clock in the server's time.
      if (game) set({ now: Date.now() + bridge.skew() });
      return;
    }
    if (!client || !game || paused || held) { lastRaw = null; return; }
    const offset = absorbStall(raw, timeOffset);
    if (offset !== timeOffset) set({ timeOffset: offset });
    const now = raw - offset;
    const next = client.tick(game, now);
    if (next === game) {
      set({ now });
      return;
    }
    set({ game: next, now });
    persist(mode, next, now);
    const done = finished(mode, game, next);
    if (done) set(done);
    if (justFinished(game, next) && isSolo(mode)) {
      set({ stats: recordGame(next, mode) });
    }
    if (next.phase === 'gameOver' && game.phase !== 'gameOver' && mode === 'daily' && dailyDate) {
      const ranked = rankPlayers(next.players);
      const me = next.players[0];
      const streak = recordResult({
        date: dailyDate, status: 'done',
        rank: ranked.findIndex((p) => p.id === 0) + 1,
        players: next.players.length, banked: me.banked,
        longest: me.longestWord.length,
      });
      set({ streak });
    }
  },

  // The clock is stopped while the tutorial pauses it or the loading screen holds it. It stops when the first of the two
  // starts and the stopped time is made up when the last one ends, so an overlap is never counted twice.
  pause() {
    const { paused, held } = get();
    if (paused) return;
    set({ paused: true, ...(held ? {} : { pausedRaw: performance.now() }) });
  },

  resume() {
    const { paused, held, pausedRaw, timeOffset } = get();
    if (!paused) return;
    set({ paused: false, ...(held ? {} : { timeOffset: timeOffset + (performance.now() - pausedRaw) }) });
  },

  holdClock() {
    const { held, paused, mode, game } = get();
    if (held || !game || mode === 'room') return;
    set({ held: true, ...(paused ? {} : { pausedRaw: performance.now() }) });
  },

  releaseClock() {
    const { held, paused, pausedRaw, timeOffset } = get();
    if (!held) return;
    set({ held: false, ...(paused ? {} : { timeOffset: timeOffset + (performance.now() - pausedRaw) }) });
  },

  refreshResume() {
    set({ resumable: loadSoloGame() });
  },

  resumeSaved() {
    const { client, game } = get();
    if (game) return false;
    const saved = loadSoloGame();
    if (!client || !saved) {
      set({ resumable: null });
      return false;
    }
    // The saved state's timestamps are in engine time, and engine time is performance.now() minus
    // timeOffset. Shifting the offset, and not the state, moves the whole clock: the game carries on
    // from the instant it stopped, so the time the tab was closed is neither charged to the player
    // nor given to them, and nothing that was mid-turn fires early or late.
    const timeOffset = performance.now() - saved.savedNow;
    lastRaw = null;
    set({
      game: saved.game, mode: saved.mode, mySeat: 0, dailyDate: null, streak: 0,
      now: saved.savedNow, paused: false, held: false, pausedRaw: 0, timeOffset, resumable: null,
    });
    return true;
  },

  resetStats() {
    set({ stats: resetStoredStats() });
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
